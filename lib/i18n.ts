/**
 * Every user-visible string in the app chrome. Claude's grading output is not
 * here — that comes back in whatever language the lesson and the answer are in.
 *
 * `en` is the source of truth; `es` is typed against it, so a missing or
 * renamed key is a compile error rather than an English string leaking through.
 */

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "locale";

/** The cookie is user-controlled, so anything unrecognised falls back to English. */
export function toLocale(raw: string | undefined): Locale {
  return LOCALES.find((l) => l === raw) ?? "en";
}

const en = {
  lang: "en",
  title: "Learn",
  description: "Spaced retrieval and memory palaces over your /teach workspaces",

  // home
  dueAcross: (due: number, topics: number) =>
    `${due} due across ${topics} ${topics === 1 ? "topic" : "topics"}`,
  nothingDue: "nothing due",
  noTopicsBefore: "No topics yet. Make one below, then run ",
  noTopicsAfter: " inside it — the lessons it writes turn up here as things to recall.",
  noWhyYet: "Mission written, no Why section yet.",
  waitingForMission: "Waiting for /teach to write MISSION.md",
  kDue: "due",
  kProbes: "probes",
  kRecall: "recall",

  // workspace
  allTopics: "All topics",
  notStarted: "Not started",
  notStartedBody:
    "Claude draws the mission out of you before anything else. Start it in a terminal:",
  review: "Review",
  noProbesYet:
    "No probes yet. They arrive with your first lesson — Claude writes them alongside it.",
  holding: (total: number, retention: number | null) =>
    `Nothing due. ${total} probes are holding` +
    (retention === null ? "" : ` at ${Math.round(retention * 100)}% recall`) +
    ".",
  recallProbes: (n: number) => `Recall ${n} ${n === 1 ? "probe" : "probes"}`,
  typedFromMemory: "Typed from memory, graded against the lesson.",
  waitingToBeTaught: "Waiting to be taught",
  waitingToBeTaughtNote:
    "Answers that showed the model was wrong, not just unretrieved. Claude reads these at the start of your next session and teaches them before anything new.",
  unprobedLessons: "Lessons with no probes",
  unprobedNote:
    "These were taught but never turned into recall, so they are not being reviewed. Ask Claude to write probes for them.",
  palaces: "Palaces",
  routeLoci: (route: string, loci: number) => `— ${route}, ${loci} loci`,
  lessons: "Lessons",
  noteCount: (n: number) => `${n} ${n === 1 ? "note" : "notes"}`,

  // the lesson reader
  notes: "Notes",
  noNotesYet: "Nothing yet. Select a passage in the lesson to write about it.",
  noNotesHere: "This isn't a lesson, so it has no notes.",
  addNote: "Note",
  notePlaceholder: "What you made of it. Yours — Claude reads these before teaching you next.",
  saveNote: "Save",
  cancel: "Cancel",
  editNote: "Edit",
  deleteNote: "Delete",
  deleteNoteConfirm: "Delete this note? It cannot be undone.",
  passageMoved: "The lesson no longer contains this passage.",
  noteSaveFailed: "That did not save. Your writing is still here — try again.",

  // review
  leave: "Leave",
  nothingDueFaded: "Nothing due. Come back when something has had time to fade.",
  sessionDone: "Session done.",
  stillDue: (n: number) => `${n} still due — start another when you have the attention for it.`,
  allCleared: "Everything due is cleared.",
  backTo: (ws: string) => `Back to ${ws}`,
  progress: (i: number, n: number) => `${i} of ${n}`,
  dueCount: (n: number) => `${n} due`,
  walk: "Walk",
  askedAgain: "Asked again",
  originallyAsked: "Originally asked:",
  youSaid: "You said",
  hintN: (n: number) => `Hint ${n}`,
  right: "Right",
  rightButThin: "Right, but thin",
  notWhatLessonSays: "Not what the lesson says",
  nextProbe: "Next probe",
  finish: "Finish",
  answerPlaceholder:
    "From memory. Don't look it up — a wrong answer here is worth more than a copied one.",
  yourAnswer: "Your answer",
  checking: "Checking…",
  check: "Check",
  claudeUnreachable: (why: string) => `Can't reach Claude, so this can't be graded. ${why}`,
  gradingFailed: "Something went wrong grading that.",

  // the decay strip, split around the bolded interval
  backInBefore: "Back in ",
  backInAfter: ".",
  learningSteps: "Still in the learning steps — no decay curve yet.",
  fallingToBefore: "Falling to the 90% line in ",
  fallingToAfter: ".",
  asksAgainThatDay: "That is the day it asks again.",
  hours: (n: number) => `${n}h`,
  days: (n: number) => `${n}d`,
  months: (n: number) => `${n} months`,

  // new topic
  topicCreated: "Topic created",
  topicCreatedBody:
    "The folders, the teaching contract and your places are in place. The mission is Claude's to draw out of you, so start it there:",
  showsUpBefore: "It shows up as started once ",
  showsUpAfter: " exists.",
  addAnother: "Add another",
  newTopic: "New topic",
  topicName: "Topic name",
  creating: "Creating…",
  create: "Create",
  nameRules: "Lowercase, no spaces. One mission per topic.",
  couldNotCreate: "Could not create it.",

  // toggles
  themeName: { system: "system", light: "light", dark: "dark" },
  themeSwitch: (now: string, next: string) => `Theme: ${now}. Switch to ${next}.`,
  langName: { en: "English", es: "Español" },
  langSwitch: (now: string, next: string) => `Language: ${now}. Switch to ${next}.`,

  // api
  nameRequired: "Give the topic a name.",
  badName: "That isn't a usable topic name.",
  alreadyExists: (ws: string) => `Topic "${ws}" already exists.`,
  unknownTopic: "Unknown topic.",
  unknownProbe: "Unknown probe.",
  badRequest: "Bad request.",
};

const es: typeof en = {
  lang: "es",
  title: "Aprender",
  description: "Recuperación espaciada y palacios de la memoria sobre tus espacios de /teach",

  dueAcross: (due, topics) =>
    `${due} ${due === 1 ? "pendiente" : "pendientes"} en ${topics} ${topics === 1 ? "tema" : "temas"}`,
  nothingDue: "nada pendiente",
  noTopicsBefore: "Todavía no hay temas. Crea uno abajo y luego ejecuta ",
  noTopicsAfter: " dentro — las lecciones que escribe aparecen aquí como cosas que recordar.",
  noWhyYet: "Misión escrita, todavía sin sección Por qué.",
  waitingForMission: "Esperando a que /teach escriba MISSION.md",
  kDue: "pendientes",
  kProbes: "pruebas",
  kRecall: "recuerdo",

  allTopics: "Todos los temas",
  notStarted: "Sin empezar",
  notStartedBody: "Claude te saca la misión antes que nada. Empieza en una terminal:",
  review: "Repaso",
  noProbesYet:
    "Todavía no hay pruebas. Llegan con tu primera lección — Claude las escribe junto a ella.",
  holding: (total, retention) =>
    `Nada pendiente. ${total} pruebas aguantan` +
    (retention === null ? "" : ` con un ${Math.round(retention * 100)}% de recuerdo`) +
    ".",
  recallProbes: (n) => `Recordar ${n} ${n === 1 ? "prueba" : "pruebas"}`,
  typedFromMemory: "Escrito de memoria, corregido contra la lección.",
  waitingToBeTaught: "Pendiente de enseñar",
  waitingToBeTaughtNote:
    "Respuestas que mostraron que el modelo estaba equivocado, no solo sin recuperar. Claude las lee al empezar tu próxima sesión y las enseña antes que nada nuevo.",
  unprobedLessons: "Lecciones sin pruebas",
  unprobedNote:
    "Se enseñaron pero nunca se convirtieron en recuerdo, así que no se repasan. Pide a Claude que les escriba pruebas.",
  palaces: "Palacios",
  routeLoci: (route, loci) => `— ${route}, ${loci} loci`,
  lessons: "Lecciones",
  noteCount: (n) => `${n} ${n === 1 ? "apunte" : "apuntes"}`,

  notes: "Apuntes",
  noNotesYet: "Todavía nada. Selecciona un fragmento de la lección para escribir sobre él.",
  noNotesHere: "Esto no es una lección, así que no tiene apuntes.",
  addNote: "Apunte",
  notePlaceholder: "Lo que sacaste en claro. Es tuyo — Claude lo lee antes de enseñarte lo siguiente.",
  saveNote: "Guardar",
  cancel: "Cancelar",
  editNote: "Editar",
  deleteNote: "Borrar",
  deleteNoteConfirm: "¿Borrar este apunte? No se puede deshacer.",
  passageMoved: "La lección ya no contiene este fragmento.",
  noteSaveFailed: "No se guardó. Lo que escribiste sigue aquí — inténtalo otra vez.",

  leave: "Salir",
  nothingDueFaded: "Nada pendiente. Vuelve cuando algo haya tenido tiempo de desvanecerse.",
  sessionDone: "Sesión terminada.",
  stillDue: (n) => `Quedan ${n} pendientes — empieza otra cuando tengas la atención para ello.`,
  allCleared: "Todo lo pendiente está hecho.",
  backTo: (ws) => `Volver a ${ws}`,
  progress: (i, n) => `${i} de ${n}`,
  dueCount: (n) => `${n} pendientes`,
  walk: "Paseo",
  askedAgain: "Preguntado otra vez",
  originallyAsked: "Pregunta original:",
  youSaid: "Dijiste",
  hintN: (n) => `Pista ${n}`,
  right: "Correcto",
  rightButThin: "Correcto, pero escaso",
  notWhatLessonSays: "No es lo que dice la lección",
  nextProbe: "Siguiente prueba",
  finish: "Terminar",
  answerPlaceholder:
    "De memoria. No lo busques — una respuesta equivocada aquí vale más que una copiada.",
  yourAnswer: "Tu respuesta",
  checking: "Comprobando…",
  check: "Comprobar",
  claudeUnreachable: (why) =>
    `No se puede contactar con Claude, así que esto no se puede corregir. ${why}`,
  gradingFailed: "Algo falló al corregir eso.",

  backInBefore: "Vuelve en ",
  backInAfter: ".",
  learningSteps: "Todavía en los pasos de aprendizaje — aún no hay curva de olvido.",
  fallingToBefore: "Cae a la línea del 90% en ",
  fallingToAfter: ".",
  asksAgainThatDay: "Ese es el día en que vuelve a preguntar.",
  hours: (n) => `${n} h`,
  days: (n) => `${n} d`,
  months: (n) => `${n} meses`,

  topicCreated: "Tema creado",
  topicCreatedBody:
    "Las carpetas, el contrato de enseñanza y tus lugares ya están. La misión te la tiene que sacar Claude, así que empieza ahí:",
  showsUpBefore: "Aparece como empezado en cuanto exista ",
  showsUpAfter: ".",
  addAnother: "Añadir otro",
  newTopic: "Tema nuevo",
  topicName: "Nombre del tema",
  creating: "Creando…",
  create: "Crear",
  nameRules: "Minúsculas, sin espacios. Una misión por tema.",
  couldNotCreate: "No se pudo crear.",

  themeName: { system: "sistema", light: "claro", dark: "oscuro" },
  themeSwitch: (now, next) => `Tema: ${now}. Cambiar a ${next}.`,
  langName: { en: "English", es: "Español" },
  langSwitch: (now, next) => `Idioma: ${now}. Cambiar a ${next}.`,

  nameRequired: "Ponle un nombre al tema.",
  badName: "Ese nombre de tema no sirve.",
  alreadyExists: (ws) => `El tema "${ws}" ya existe.`,
  unknownTopic: "Tema desconocido.",
  unknownProbe: "Prueba desconocida.",
  badRequest: "Petición incorrecta.",
};

export type Strings = typeof en;

export const dict: Record<Locale, Strings> = { en, es };
