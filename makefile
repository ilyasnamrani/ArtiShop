help: ## Affiche les cibles disponibles et leur usage
	@awk -F'[: ]+##' '/^[a-zA-Z0-9_-]+:.*##/ { printf "%-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

PORT ?= 3000
NPM ?= npm
NODE ?= node
URL = http://localhost:$(PORT)
DIST = dist
ARCHIVE = $(DIST)/artishop-$(VERSION).tar.gz
VERSION = $(shell node -p "require('./package.json').version")
PID_FILE = .artishop.pid
LOG_FILE = .artishop.log
CI ?= false

INSTALL_CMD = $(NPM) install
ifeq ($(CI),true)
  INSTALL_CMD = $(NPM) ci
endif

.PHONY: help install start dev test clean health start-bg stop status restart package ci

install: node_modules ## Installe les dépendances du projet

node_modules: package.json package-lock.json
	@$(INSTALL_CMD)
	@touch $@

start: node_modules ## Démarre l'application en mode normal
	PORT=$(PORT) $(NPM) start

dev: node_modules ## Démarre l'application en mode développement
	PORT=$(PORT) $(NPM) run dev

test: node_modules ## Lance les tests automatisés
	@$(NPM) test

clean: ## Supprime le dossier de build et les journaux
	@rm -rf $(DIST) *.log

health: ## Vérifie que l'API répond sur le port configuré
	@curl -fsS $(URL)/health || { echo "Health check failed for $(URL)"; exit 1; }

start-bg: node_modules ## Démarre le serveur en arrière-plan
	@PORT=$(PORT) $(NODE) src/server.js > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
		sleep 1; \
		echo "Serveur démarré sur $(URL) (PID $$(cat $(PID_FILE)))"

stop: ## Arrête le serveur background et supprime le fichier PID
	@if [ -f $(PID_FILE) ]; then \
		pid=$$(cat $(PID_FILE)); \
		if kill -0 $$pid 2>/dev/null; then kill $$pid; fi; \
		rm -f $(PID_FILE); \
		echo "Serveur arrêté."; \
	else \
		echo "Aucun serveur en cours."; \
	fi

status: ## Indique si le serveur est actuellement actif
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Serveur actif sur $(URL) (PID $$(cat $(PID_FILE)))"; \
	else \
		echo "Serveur inactif sur $(URL)"; \
	fi

restart: ## Redémarre le serveur en réutilisant les cibles de contrôle
	$(MAKE) stop
	$(MAKE) start-bg

$(DIST):
	@mkdir -p $@

source_files := $(shell find src public -type f 2>/dev/null) package.json README.md
$(ARCHIVE): $(source_files) | $(DIST)
	@tar -czf $@ -C . src public package.json README.md .gitignore

package: $(ARCHIVE) ## Crée l'archive livrable du projet

ci: ## Exécute le pipeline d'intégration continue local
	@$(MAKE) CI=true install
	@$(MAKE) test
	@$(MAKE) package
