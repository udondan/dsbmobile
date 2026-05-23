# @udondan/dsbmobile

Node.js-Paket für den Zugriff auf [DSBmobile](https://www.dsbmobile.de) – die digitale Schulkommunikationsplattform für Vertretungspläne, Neuigkeiten und Dokumente. Es kapselt die DSBmobile-API und bietet drei Schnittstellen über einen gemeinsamen Kern:

- **SDK** – importierbare `DsbmobileClient`-Klasse für Node.js-Projekte
- **CLI** – `dsbmobile`-Befehl für das Terminal
- **MCP-Server** – `dsbmobile mcp` stellt alle Funktionen als Tools für KI-Assistenten bereit

## Inhalt

- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [SDK](#sdk)
- [CLI](#cli)
- [MCP-Server](#mcp-server)
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

## MCP-Server

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
  - `period`: Stunde(n) (z. B. `3` oder `5 - 6`)
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
git clone https://github.com/udondan/dsbmobile-mcp.git
cd dsbmobile-mcp

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
```

## Lizenz

MIT
