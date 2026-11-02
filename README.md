# @udondan/dsbmobile

[![npm](https://img.shields.io/npm/v/@udondan/dsbmobile)](https://www.npmjs.com/package/@udondan/dsbmobile)
[![Docker](https://img.shields.io/docker/v/udondan/dsbmobile?sort=semver&label=docker)](https://hub.docker.com/r/udondan/dsbmobile)
[![Node.js](https://img.shields.io/node/v/@udondan/dsbmobile)](https://www.npmjs.com/package/@udondan/dsbmobile)
[![CI](https://github.com/udondan/dsbmobile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/udondan/dsbmobile/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/udondan/dsbmobile/graph/badge.svg)](https://codecov.io/gh/udondan/dsbmobile)
[![License](https://img.shields.io/github/license/udondan/dsbmobile)](LICENSE)

Node.js-Paket für den Zugriff auf [DSBmobile](https://www.dsbmobile.de) – die digitale Schulkommunikationsplattform für Vertretungspläne, Neuigkeiten und Dokumente. Es kapselt die DSBmobile-API und bietet drei Schnittstellen über einen gemeinsamen Kern:

- **SDK** – importierbare `DsbmobileClient`-Klasse für Node.js-Projekte
- **CLI** – `dsbmobile`-Befehl für das Terminal
- **MCP-Server** – `dsbmobile mcp` stellt alle Funktionen als Tools für KI-Assistenten bereit

## Inhalt

- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [SDK](#sdk)
- [CLI](#cli)
  - [Mit Docker](#mit-docker)
- [MCP-Server](#mcp-server)
  - [Docker MCP Toolkit](#docker-mcp-toolkit)
- [Verfügbare MCP-Tools](#verfügbare-mcp-tools)
- [Entwicklung](#entwicklung)
- [Lizenz](#lizenz)

## Installation

```bash
# Globale Installation (empfohlen für CLI-Nutzung)
npm install -g @udondan/dsbmobile

# Ohne Installation direkt nutzen
DSB_USERNAME=benutzername DSB_PASSWORD=passwort npx @udondan/dsbmobile mcp
```

CLI und MCP-Server gibt es auch als Docker-Image
[`udondan/dsbmobile`](https://hub.docker.com/r/udondan/dsbmobile) (amd64 und
arm64), ohne dass Node.js installiert sein muss. Siehe [Mit Docker](#mit-docker).

## Konfiguration

Die Zugangsdaten werden über Umgebungsvariablen übergeben:

| Variable       | Pflicht | Beschreibung                                                                                        |
| -------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `DSB_USERNAME` | ✅      | DSBmobile-Benutzername bzw. -ID                                                                     |
| `DSB_PASSWORD` | ✅      | DSBmobile-Passwort                                                                                  |
| `DSB_CLASS`    | ❌      | Standard-Klassenfilter für `get_substitutions` (z. B. `07b`). Kann pro Aufruf überschrieben werden. |

## SDK

```bash
npm install @udondan/dsbmobile
```

```ts
import { DsbmobileClient } from '@udondan/dsbmobile';

const client = new DsbmobileClient({
  username: process.env.DSB_USERNAME!,
  password: process.env.DSB_PASSWORD!,
});

// Vertretungsplan abrufen
const plans = await client.getSubstitutions();

// Timetable-Einträge (Plan-URLs) abrufen
const timetables = await client.getTimetables();

// Neuigkeiten abrufen
const news = await client.getNews();

// Dokumente abrufen
const documents = await client.getDocuments();
```

### Exportierte Typen

```ts
import type {
  DsbmobileConfig,
  SubstitutionPlan,
  SubstitutionEntry,
  TimetableEntry,
  NewsEntry,
  DocumentEntry,
  DsbItem,
} from '@udondan/dsbmobile';
```

## CLI

```bash
# Vertretungspläne als JSON ausgeben
dsbmobile substitutions

# Nur eine bestimmte Klasse (überschreibt DSB_CLASS)
dsbmobile substitutions --class 07b

# Timetable-Einträge (Plan-URLs) als JSON ausgeben
dsbmobile timetables

# Neuigkeiten als JSON ausgeben
dsbmobile news

# Dokumente als JSON ausgeben
dsbmobile documents

# MCP-Server über stdio starten
dsbmobile mcp
```

### Mit Docker

Argumente nach dem Image-Namen gehen an das CLI. `-e NAME` ohne Wert übernimmt
die Variable aus der eigenen Shell:

```bash
docker run --rm -e DSB_USERNAME -e DSB_PASSWORD -e DSB_CLASS udondan/dsbmobile substitutions
```

Als Alias verhält sich das Image wie ein installiertes `dsbmobile`:

```bash
alias dsbmobile='docker run --rm -e DSB_USERNAME -e DSB_PASSWORD -e DSB_CLASS udondan/dsbmobile'

dsbmobile substitutions --class 07b
```

## MCP-Server

Der Server läuft über stdio, entweder per `npx` (siehe unten) oder als
Docker-Image:

```bash
docker run --rm -i -e DSB_USERNAME -e DSB_PASSWORD -e DSB_CLASS udondan/dsbmobile
```

Ohne Argumente startet das Image den MCP-Server. `-i` hält stdin offen, über das
der Server mit dem Client spricht.

### Einrichtung in Claude Code

```bash
claude mcp add dsbmobile -- npx @udondan/dsbmobile mcp
```

Anschließend die Zugangsdaten in der MCP-Konfiguration hinterlegen (`~/.claude.json` oder `.claude/settings.json`):

```json
{
  "mcpServers": {
    "dsbmobile": {
      "command": "npx",
      "args": ["@udondan/dsbmobile", "mcp"],
      "env": {
        "DSB_USERNAME": "benutzername",
        "DSB_PASSWORD": "passwort",
        "DSB_CLASS": "07b"
      }
    }
  }
}
```

### Einrichtung in Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dsbmobile": {
      "command": "npx",
      "args": ["@udondan/dsbmobile", "mcp"],
      "env": {
        "DSB_USERNAME": "benutzername",
        "DSB_PASSWORD": "passwort",
        "DSB_CLASS": "07b"
      }
    }
  }
}
```

Mit Docker statt `npx` sieht der Eintrag so aus. `-e NAME` ohne Wert reicht die
Variable aus `env` an den Container weiter:

```json
{
  "mcpServers": {
    "dsbmobile": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "DSB_USERNAME",
        "-e",
        "DSB_PASSWORD",
        "-e",
        "DSB_CLASS",
        "udondan/dsbmobile"
      ],
      "env": {
        "DSB_USERNAME": "benutzername",
        "DSB_PASSWORD": "passwort",
        "DSB_CLASS": "07b"
      }
    }
  }
}
```

### Einrichtung in anderen MCP-Clients

```json
{
  "command": "npx",
  "args": ["@udondan/dsbmobile", "mcp"],
  "env": {
    "DSB_USERNAME": "benutzername",
    "DSB_PASSWORD": "passwort",
    "DSB_CLASS": "07b"
  }
}
```

### Docker MCP Toolkit

Mit dem [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/)
von Docker Desktop läuft der Server als Container hinter dem MCP Gateway. Das
Gateway startet den Container bei Bedarf und reicht seine Tools an die
verbundenen Clients weiter. Die Zugangsdaten liegen als Secrets in Docker Desktop
statt im Klartext in der Client-Konfiguration.

Voraussetzung ist Docker Desktop mit aktiviertem MCP Toolkit.

1. Die Server-Definition [`docker-mcp.yml`](docker-mcp.yml) herunterladen und
   einem Toolkit-Profil hinzufügen. Das Toolkit liest solche Dateien nur aus
   seinem Katalog-Verzeichnis:

   ```bash
   mkdir -p ~/.docker/mcp/catalogs
   curl -fsSL https://raw.githubusercontent.com/udondan/dsbmobile/main/docker-mcp.yml -o ~/.docker/mcp/catalogs/dsbmobile.yml

   # neues Profil "dsbmobile" ...
   docker mcp profile create --name dsbmobile --id dsbmobile --server "file://$HOME/.docker/mcp/catalogs/dsbmobile.yml"
   # ... oder einem bestehenden Profil hinzufügen
   docker mcp profile server add default --server "file://$HOME/.docker/mcp/catalogs/dsbmobile.yml"
   ```

   Das Profil behält das Image in der Version, die es beim Hinzufügen hatte.
   Zum Aktualisieren `profile server add` erneut ausführen.

2. Die Zugangsdaten als Secrets hinterlegen (`dsbmobile.class` ist optional):

   ```bash
   docker mcp secret set dsbmobile.username=benutzername
   docker mcp secret set dsbmobile.password=passwort
   docker mcp secret set dsbmobile.class=07b
   ```

3. Einen Client mit dem Profil verbinden:

   ```bash
   docker mcp client connect claude-desktop --profile dsbmobile
   ```

   `docker mcp client connect --help` listet weitere Clients wie `claude-code`,
   `cursor` oder `vscode`. Das geht auch in Docker Desktop unter _MCP Toolkit_.

`docker mcp gateway run --profile dsbmobile --dry-run --verbose` prüft die
Einrichtung, ohne einen Client zu starten. Die Ausgabe sollte die Zeile
`dsbmobile: (4 tools)` enthalten.

## Verfügbare MCP-Tools

### `get_timetables`

Gibt alle verfügbaren Vertretungsplan-Einträge zurück.

**Rückgabe**: Liste von Plan-Einträgen, jeweils mit:

- `id`: Eindeutige ID
- `title`: Planname (z. B. „V-Homepage heute - subst_001 (Seite 1)")
- `date`: Zeitstempel der letzten Aktualisierung im Format `TT.MM.JJJJ HH:MM`
- `url`: Link zur HTML-Planseite mit der Vertretungstabelle
- `previewUrl`: Link zu einem Vorschaubild (optional)

### `get_substitutions`

Lädt und parst alle Vertretungsplan-Seiten und gibt strukturierte Einträge zurück.

**Parameter**:

- `className` (optional): Klassenfilter, z. B. `07b` oder `Q2_Kra`. Groß-/Kleinschreibung wird ignoriert. Standardmäßig wird `DSB_CLASS` verwendet, falls gesetzt.

**Rückgabe**: Liste von Plänen (ein Objekt pro Tag), jeweils mit:

- `date`: Datum im ISO-Format (z. B. `2026-03-20`)
- `lastUpdated`: Zeitstempel der letzten Aktualisierung
- `entries`: Liste der Vertretungseinträge, jeweils mit:
  - `className`: Klasse (z. B. `07b`, `Q2_Kra`)
  - `type`: Art der Vertretung (z. B. `Vertretung`, `Statt-Vertretung`, `Entfall`)
  - `period`: Stunde(n) (z. B. `3` oder `5 - 6`). Einträge, die sich nur durch direkt aufeinanderfolgende Stunden unterscheiden, werden zu einem Bereich zusammengefasst (aus `3` und `4` wird `3 - 4`).
  - `originalTeacher`: Kürzel der vertretenen Lehrkraft
  - `substituteTeacher`: Kürzel der vertretenden Lehrkraft
  - `subject`: Fachkürzel (z. B. `SPO`, `ETHI`, `E`)
  - `originalRoom`: Ursprünglicher Raum
  - `substituteRoom`: Ausweichraum
  - `text`: Zusätzliche Hinweise

### `get_news`

Ruft alle Neuigkeiten und Ankündigungen von DSBmobile ab.

**Rückgabe**: Liste von Nachrichten, jeweils mit `id`, `title`, `detail`, `date`, `tags`.

### `get_documents`

Listet alle verfügbaren Dokumente und Dateien auf.

**Rückgabe**: Liste von Dokumenten, jeweils mit `id`, `title`, `url`, `date`.

## Sicherheit

- **CLI und MCP-Server**: Zugangsdaten werden ausschließlich über Umgebungsvariablen übergeben und nie im Code hinterlegt
- **SDK**: Zugangsdaten werden explizit als `DsbmobileConfig`-Objekt im Konstruktor übergeben – nie hartcodiert oder aus Umgebungsvariablen gelesen
- Zugangsdaten erscheinen weder in Logs noch in Fehlermeldungen
- Es werden keine sensiblen Daten auf der Festplatte gespeichert
- Der Server ist schreibgeschützt – er kann keine Daten auf DSBmobile verändern

## Entwicklung

```bash
# Repository klonen
git clone https://github.com/udondan/dsbmobile.git
cd dsbmobile

# Abhängigkeiten installieren
bun install

# TypeScript kompilieren
bun run build

# Im Watch-Modus kompilieren
bun run dev

# MCP-Server starten
DSB_USERNAME=benutzername DSB_PASSWORD=passwort node dist/cli.js mcp

# Tests ausführen
bun run test

# Lint
bun run lint

# Docker-Image bauen und einem Docker MCP Toolkit-Profil hinzufügen
mise run docker-build                # docker build -t udondan/dsbmobile .
mise run docker-register [profil]    # Standard-Profil: dsbmobile
mise run docker                      # beides
```

Das lokal gebaute `udondan/dsbmobile:latest` ersetzt das öffentliche Image, das
Docker MCP Toolkit nutzt also den lokalen Build. `docker pull udondan/dsbmobile`
wechselt zurück.

## Lizenz

MIT
