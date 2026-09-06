import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  en: {
    translation: {
      common: {
        dashboard: "Dashboard",
        jobs: "Jobs",
        engineers: "Engineers",
        clients: "Clients",
        invoices: "Invoices",
        estimates: "Estimates",
        settings: "Settings",
        save: "Save",
        cancel: "Cancel",
        search: "Search",
        loading: "Loading...",
      },
      scheduler: {
        title: "Drag-Drop Scheduler",
        subtitle: "Drag jobs onto engineers to assign",
        unassigned: "Unassigned Jobs",
        empty: "No unassigned jobs",
      },
      billing: {
        recurring: "Recurring Billing",
        subscriptions: "Subscriptions",
        nextRun: "Next Invoice",
        active: "Active",
        paused: "Paused",
      },
    },
  },
  es: {
    translation: {
      common: {
        dashboard: "Panel",
        jobs: "Trabajos",
        engineers: "Ingenieros",
        clients: "Clientes",
        invoices: "Facturas",
        estimates: "Presupuestos",
        settings: "Ajustes",
        save: "Guardar",
        cancel: "Cancelar",
        search: "Buscar",
        loading: "Cargando...",
      },
      scheduler: {
        title: "Programador Arrastrar y Soltar",
        subtitle: "Arrastra trabajos a ingenieros para asignar",
        unassigned: "Trabajos sin asignar",
        empty: "No hay trabajos sin asignar",
      },
      billing: {
        recurring: "Facturación Recurrente",
        subscriptions: "Suscripciones",
        nextRun: "Próxima factura",
        active: "Activo",
        paused: "Pausado",
      },
    },
  },
  fr: {
    translation: {
      common: {
        dashboard: "Tableau de bord",
        jobs: "Missions",
        engineers: "Ingénieurs",
        clients: "Clients",
        invoices: "Factures",
        estimates: "Devis",
        settings: "Paramètres",
        save: "Enregistrer",
        cancel: "Annuler",
        search: "Rechercher",
        loading: "Chargement...",
      },
      scheduler: {
        title: "Planificateur Glisser-Déposer",
        subtitle: "Faites glisser les missions vers les ingénieurs",
        unassigned: "Missions non assignées",
        empty: "Aucune mission non assignée",
      },
      billing: {
        recurring: "Facturation récurrente",
        subscriptions: "Abonnements",
        nextRun: "Prochaine facture",
        active: "Actif",
        paused: "En pause",
      },
    },
  },
  de: {
    translation: {
      common: {
        dashboard: "Übersicht",
        jobs: "Aufträge",
        engineers: "Techniker",
        clients: "Kunden",
        invoices: "Rechnungen",
        estimates: "Angebote",
        settings: "Einstellungen",
        save: "Speichern",
        cancel: "Abbrechen",
        search: "Suchen",
        loading: "Lädt...",
      },
      scheduler: {
        title: "Drag-and-Drop Planer",
        subtitle: "Aufträge auf Techniker ziehen zum Zuweisen",
        unassigned: "Nicht zugewiesene Aufträge",
        empty: "Keine offenen Aufträge",
      },
      billing: {
        recurring: "Wiederkehrende Abrechnung",
        subscriptions: "Abonnements",
        nextRun: "Nächste Rechnung",
        active: "Aktiv",
        paused: "Pausiert",
      },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
  });

export default i18n;
