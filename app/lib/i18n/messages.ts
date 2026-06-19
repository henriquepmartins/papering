// Lightweight i18n dictionaries for Papering. No library — the app has a small,
// fixed string set, so two flat dictionaries keyed by the same identifiers keep
// it dependency-free and easy to scan. Portuguese is the default locale.

export type Locale = "pt" | "en";

export const LOCALES: Locale[] = ["pt", "en"];

// Every key must exist in both dictionaries. `Messages` is derived from the
// Portuguese dictionary so TypeScript flags any key missing from `en`.
export type MessageKey = keyof typeof pt;
export type Messages = Record<MessageKey, string>;

export const pt = {
  // Generic / note state
  "note.new": "Nova nota",
  "note.untitled": "Sem título",
  "editor.placeholder": "Comece a escrever…",
  "hints.characters": "{n} caracteres",

  // Titlebar buttons
  "btn.shortcuts": "Atalhos",
  "btn.notes": "Notas",
  "btn.newNote": "Nova nota",
  "btn.settings": "Ajustes",
  "btn.formatting": "Formatação",

  // Notes popover
  "notes.empty": "Nenhuma nota ainda",
  "notes.delete": "Excluir nota",
  "notes.confirmDelete": "Confirmar exclusão",

  // Shortcuts popover
  "sc.capture": "Capturar",
  "sc.saveClose": "Salvar e fechar",
  "sc.bold": "Negrito",
  "sc.italic": "Itálico",
  "sc.code": "Código",
  "sc.strike": "Tachado",
  "sc.newNote": "Nova nota",
  "sc.openNotes": "Abrir notas",
  "sc.settings": "Ajustes",

  // Settings popover
  "settings.title": "Ajustes",
  "settings.language": "Idioma",
  "settings.lang.pt": "Português",
  "settings.lang.en": "Inglês",

  // Context menu / formatting actions
  "ctx.cut": "Recortar",
  "ctx.copy": "Copiar",
  "ctx.paste": "Colar",
  "ctx.bold": "Negrito",
  "ctx.italic": "Itálico",
  "ctx.code": "Código",
  "ctx.strike": "Tachado",
  "ctx.highlight": "Marca-texto",
  "ctx.link": "Link",
  "ctx.clearFormat": "Limpar formatação",
  "ctx.insertHeading": "Título",
  "ctx.insertBulletList": "Lista",
  "ctx.insertTaskList": "Lista de tarefas",
  "ctx.insertQuote": "Citação",
  "ctx.insertDate": "Inserir data",
  "ctx.newNote": "Nova nota",
  "ctx.openNotes": "Abrir notas",
  "ctx.settings": "Ajustes",
  "ctx.shortcuts": "Atalhos",
  "ctx.group.format": "Formatar",
  "ctx.group.insert": "Inserir",

  // Slash menu
  "slash.heading1": "Título 1",
  "slash.heading2": "Título 2",
  "slash.heading3": "Título 3",
  "slash.bulletList": "Lista",
  "slash.orderedList": "Lista numerada",
  "slash.taskList": "Lista de tarefas",
  "slash.quote": "Citação",
  "slash.codeBlock": "Bloco de código",
  "slash.divider": "Divisória",
  "slash.table": "Tabela",
  "slash.date": "Inserir data",
  "slash.heading1.hint": "Título grande",
  "slash.heading2.hint": "Título médio",
  "slash.heading3.hint": "Título pequeno",
  "slash.bulletList.hint": "Lista com marcadores",
  "slash.orderedList.hint": "Lista com números",
  "slash.taskList.hint": "Caixas de seleção",
  "slash.quote.hint": "Bloco de citação",
  "slash.codeBlock.hint": "Código com formatação",
  "slash.divider.hint": "Linha divisória",
  "slash.table.hint": "Tabela com cabeçalho",
  "slash.date.hint": "Data de hoje",
  "slash.empty": "Nenhum comando",

  // Welcome card
  "welcome.title": "Bem-vindo ao Papering",
  "welcome.subtitle": "Um lugar rápido e tranquilo para escrever suas notas.",
  "welcome.tip.new": "criar uma nova nota",
  "welcome.tip.notes": "abrir suas notas",
  "welcome.tip.shortcuts": "ver os atalhos",
  "welcome.tip.settings": "abrir os ajustes",
  "welcome.tip.rightClick": "clique com o botão direito para ver os comandos",
  "welcome.tip.slash": "digite / para inserir título, lista, tarefas…",
  "welcome.dismiss": "Entendi",
} as const;

export const en: Messages = {
  "note.new": "New note",
  "note.untitled": "Untitled",
  "editor.placeholder": "Start writing…",
  "hints.characters": "{n} characters",

  "btn.shortcuts": "Shortcuts",
  "btn.notes": "Notes",
  "btn.newNote": "New note",
  "btn.settings": "Settings",
  "btn.formatting": "Formatting",

  "notes.empty": "No notes yet",
  "notes.delete": "Delete note",
  "notes.confirmDelete": "Confirm delete",

  "sc.capture": "Capture",
  "sc.saveClose": "Save & close",
  "sc.bold": "Bold",
  "sc.italic": "Italic",
  "sc.code": "Inline code",
  "sc.strike": "Strikethrough",
  "sc.newNote": "New note",
  "sc.openNotes": "Open notes",
  "sc.settings": "Settings",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.lang.pt": "Portuguese",
  "settings.lang.en": "English",

  "ctx.cut": "Cut",
  "ctx.copy": "Copy",
  "ctx.paste": "Paste",
  "ctx.bold": "Bold",
  "ctx.italic": "Italic",
  "ctx.code": "Code",
  "ctx.strike": "Strikethrough",
  "ctx.highlight": "Highlight",
  "ctx.link": "Link",
  "ctx.clearFormat": "Clear formatting",
  "ctx.insertHeading": "Heading",
  "ctx.insertBulletList": "List",
  "ctx.insertTaskList": "To-do list",
  "ctx.insertQuote": "Quote",
  "ctx.insertDate": "Insert date",
  "ctx.newNote": "New note",
  "ctx.openNotes": "Open notes",
  "ctx.settings": "Settings",
  "ctx.shortcuts": "Shortcuts",
  "ctx.group.format": "Format",
  "ctx.group.insert": "Insert",

  "slash.heading1": "Heading 1",
  "slash.heading2": "Heading 2",
  "slash.heading3": "Heading 3",
  "slash.bulletList": "Bullet list",
  "slash.orderedList": "Numbered list",
  "slash.taskList": "To-do list",
  "slash.quote": "Quote",
  "slash.codeBlock": "Code block",
  "slash.divider": "Divider",
  "slash.table": "Table",
  "slash.date": "Insert date",
  "slash.heading1.hint": "Big section heading",
  "slash.heading2.hint": "Medium section heading",
  "slash.heading3.hint": "Small section heading",
  "slash.bulletList.hint": "A simple bulleted list",
  "slash.orderedList.hint": "A numbered list",
  "slash.taskList.hint": "Track tasks with checkboxes",
  "slash.quote.hint": "Capture a quote",
  "slash.codeBlock.hint": "Code with formatting",
  "slash.divider.hint": "A horizontal divider",
  "slash.table.hint": "Table with a header row",
  "slash.date.hint": "Today's date",
  "slash.empty": "No commands",

  "welcome.title": "Welcome to Papering",
  "welcome.subtitle": "A fast, calm place to write your notes.",
  "welcome.tip.new": "create a new note",
  "welcome.tip.notes": "open your notes",
  "welcome.tip.shortcuts": "see the shortcuts",
  "welcome.tip.settings": "open settings",
  "welcome.tip.rightClick": "right-click to see the commands",
  "welcome.tip.slash": "type / to insert heading, list, to-dos…",
  "welcome.dismiss": "Got it",
};

export const dictionaries: Record<Locale, Messages> = { pt, en };

export const DEFAULT_LOCALE: Locale = "pt";

// Resolve a message and interpolate `{name}` placeholders. Falls back to the key
// itself if missing (only possible while editing the dictionaries).
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  let out: string = dict[key] ?? pt[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }
  }
  return out;
}
