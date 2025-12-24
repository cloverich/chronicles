# Search System Architecture

## Overview

The search system in Chronicles is designed to convert raw user input strings into structured query objects called **Search Tokens**. It was inspired by the simple text searching of github issues; the implementation is rudiemntary but functional.

## Pipeline Architecture

The search parsing pipeline follows a router-based design pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                       User Input                            │
│                  "in:personal project-alpha"                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SearchParser                          │
│                (src/views/documents/SearchParser.ts)        │
│                                                             │
│  1. Splits input into raw token strings                     │
│  2. Checks for "prefix:value" pattern (Regex: ^(.*):(.*))   │
│  3. Routes to specific TokenParser based on prefix          │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────────┐
│ JournalTokenParser│ │TextTokenParser│ │  TagTokenParser   │
│   (prefix "in:")  │ │  (no prefix)  │ │   (prefix "tag:") │
└───────────────────┘ └───────────────┘ └───────────────────┘
          │                   │                   │
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                        Search Tokens                        │
│ [                                                           │
│   { type: 'in', value: 'personal' },                        │
│   { type: 'text', value: 'project-alpha' }                  │
│ ]                                                           │
└─────────────────────────────────────────────────────────────┘
```

## Search Tokens

The system defines several token types (`src/views/documents/search/tokens.ts`):

| Prefix    | Token Type     | Description                                 | Example             |
| :-------- | :------------- | :------------------------------------------ | :------------------ |
| `in:`     | `JournalToken` | Filters documents by journal name           | `in:work`           |
| `tag:`    | `TagToken`     | Filters documents containing a specific tag | `tag:todo`          |
| `title:`  | `TitleToken`   | Searches only within document titles        | `title:meeting`     |
| `before:` | `BeforeToken`  | Filters documents created before a date     | `before:2023-01-01` |
| `filter:` | `FilterToken`  | Advanced node matching (AST)                | _Internal use_      |
| _(none)_  | `TextToken`    | Standard full-text search                   | `banana`            |

## Components

| Component              | Path                                      |
| :--------------------- | :---------------------------------------- |
| **Orchestrator**       | `src/views/documents/SearchParser.ts`     |
| **Token Definitions**  | `src/views/documents/search/tokens.ts`    |
| **Individual Parsers** | `src/views/documents/search/parsers/*.ts` |
