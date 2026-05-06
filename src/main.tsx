import React from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ImageIcon, Loader2, Maximize2, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import type { Poster, PosterIndex, PosterSection, PosterSummary } from "../shared/types";
import "./styles.css";

const isStaticPosters = import.meta.env.VITE_STATIC_POSTERS === "true";
const baseUrl = import.meta.env.BASE_URL;
const locales = ["de", "en", "uk"] as const;

type Locale = (typeof locales)[number];

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

const translations: Record<
  Locale,
  {
    title: string;
    kicker: string;
    generateOwn: string;
    languageNav: string;
    languageName: string;
    flag: string;
    generatedPosters: string;
    loadingPosters: string;
    loadingPoster: string;
    emptyGallery: string;
    backToGallery: string;
    deleteTitle: string;
    confirmDelete: (title: string) => string;
    deleteLabel: (title: string) => string;
    readSection: (label: string) => string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
  }
> = {
  de: {
    title: "Sprechende Poster",
    kicker: "Lokale Postersammlung",
    generateOwn: "Selbst erstellen",
    languageNav: "Sprache wechseln",
    languageName: "Deutsch",
    flag: "🇩🇪",
    generatedPosters: "Erstellte Poster",
    loadingPosters: "Poster werden geladen",
    loadingPoster: "Poster wird geladen",
    emptyGallery: "Noch keine Poster in dieser Sprache.",
    backToGallery: "Zur Galerie",
    deleteTitle: "Poster löschen",
    confirmDelete: (title) => `"${title}" löschen? Dadurch werden Posterdateien und erzeugte Audiodateien entfernt.`,
    deleteLabel: (title) => `${title} löschen`,
    readSection: (label) => `Text vorlesen: ${label}`,
    zoomIn: "Vergrößern",
    zoomOut: "Verkleinern",
    resetZoom: "An Bildschirm anpassen"
  },
  en: {
    title: "Talking Posters",
    kicker: "Generated poster library",
    generateOwn: "Generate your own",
    languageNav: "Switch language",
    languageName: "English",
    flag: "🇬🇧",
    generatedPosters: "Generated posters",
    loadingPosters: "Loading posters",
    loadingPoster: "Loading poster",
    emptyGallery: "No English posters yet.",
    backToGallery: "Back to gallery",
    deleteTitle: "Delete poster",
    confirmDelete: (title) => `Delete "${title}"? This removes the poster files and generated audio.`,
    deleteLabel: (title) => `Delete ${title}`,
    readSection: (label) => `Read text: ${label}`,
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetZoom: "Fit to screen"
  },
  uk: {
    title: "Постери, що говорять",
    kicker: "Локальна колекція постерів",
    generateOwn: "Створити власний",
    languageNav: "Змінити мову",
    languageName: "Українська",
    flag: "🇺🇦",
    generatedPosters: "Створені постери",
    loadingPosters: "Постери завантажуються",
    loadingPoster: "Постер завантажується",
    emptyGallery: "Ще немає постерів цією мовою.",
    backToGallery: "До галереї",
    deleteTitle: "Видалити постер",
    confirmDelete: (title) => `Видалити "${title}"? Це прибере файли постера та створені аудіофайли.`,
    deleteLabel: (title) => `Видалити ${title}`,
    readSection: (label) => `Прочитати текст: ${label}`,
    zoomIn: "Збільшити",
    zoomOut: "Зменшити",
    resetZoom: "Вмістити на екрані"
  }
};

function App() {
  const [path, setPath] = React.useState(getCurrentPath());

  React.useEffect(() => {
    const onPopState = () => setPath(getCurrentPath());
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, []);

  const navigate = React.useCallback((to: string) => {
    if (isStaticPosters) {
      window.location.hash = to;
    } else {
      window.history.pushState({}, "", to);
    }
    setPath(to);
  }, []);

  const route = parseRoute(path);
  if (route.kind === "poster") {
    return <PosterView id={route.id} locale={route.locale} navigate={navigate} />;
  }

  return <Gallery locale={route.locale} navigate={navigate} />;
}

function Gallery({ locale, navigate }: { locale: Locale; navigate: (to: string) => void }) {
  const posters = useJson<PosterIndex>(posterIndexUrl());
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(() => new Set());
  const t = translations[locale];

  async function deletePoster(poster: PosterSummary) {
    const confirmed = window.confirm(t.confirmDelete(poster.title));
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/posters/${encodeURIComponent(poster.id)}`, { method: "DELETE" });
    if (!response.ok) {
      window.alert(await formatDeleteError(response));
      return;
    }

    setDeletedIds((current) => {
      const next = new Set(current);
      next.add(poster.id);
      return next;
    });
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <div>
          <p className="kicker">{t.kicker}</p>
          <h1>{t.title}</h1>
        </div>
        <div className="masthead-actions">
          <nav className="locale-switch" aria-label={t.languageNav}>
            {locales.map((candidate) => (
              <button
                key={candidate}
                className={candidate === locale ? "is-active" : ""}
                onClick={() => navigate(`/${candidate}`)}
                aria-current={candidate === locale ? "page" : undefined}
                aria-label={translations[candidate].languageName}
                title={translations[candidate].languageName}
              >
                <span aria-hidden="true">{translations[candidate].flag}</span>
              </button>
            ))}
          </nav>
          <a className="command-strip" href="https://github.com/jona-sassenhagen/talking_posters">
            <span>{t.generateOwn}</span>
          </a>
        </div>
      </header>

      {posters.status === "loading" && <Loading label={t.loadingPosters} />}
      {posters.status === "error" && <ErrorBox message={posters.error} />}
      {posters.status === "ready" && (
        <section className="gallery-grid" aria-label={t.generatedPosters}>
          {posters.data.posters
            .filter((poster) => posterLocale(poster) === locale && !deletedIds.has(poster.id))
            .map((poster) => (
              <PosterCard key={poster.id} poster={poster} locale={locale} navigate={navigate} onDelete={isStaticPosters ? undefined : deletePoster} />
            ))}
          {posters.data.posters.filter((poster) => posterLocale(poster) === locale && !deletedIds.has(poster.id)).length === 0 && (
            <div className="empty-state">
              <ImageIcon aria-hidden="true" />
              <p>{t.emptyGallery}</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function PosterCard({
  poster,
  locale,
  navigate,
  onDelete
}: {
  poster: PosterSummary;
  locale: Locale;
  navigate: (to: string) => void;
  onDelete?: (poster: PosterSummary) => void;
}) {
  return (
    <article className="poster-card">
      <button className="poster-open" onClick={() => navigate(`/${locale}/poster/${poster.id}`)}>
        <span className="thumb-frame">
          <img src={assetUrl(poster.image)} alt="" loading="lazy" />
        </span>
        <span className="poster-card-copy">
          <span>{poster.title}</span>
          <small>{new Date(poster.createdAt).toLocaleString()}</small>
        </span>
      </button>
      {onDelete && (
        <button className="delete-button" onClick={() => onDelete(poster)} aria-label={translations[locale].deleteLabel(poster.title)} title={translations[locale].deleteTitle}>
          <Trash2 aria-hidden="true" />
        </button>
      )}
    </article>
  );
}

async function formatDeleteError(response: Response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) {
      return parsed.error;
    }
  } catch {
    // Fall through to include raw response text.
  }

  const suffix = body.trim() ? ` ${body.trim().slice(0, 180)}` : "";
  return `Could not delete this poster. HTTP ${response.status}.${suffix}`;
}

function PosterView({ id, locale, navigate }: { id: string; locale: Locale; navigate: (to: string) => void }) {
  const poster = useJson<Poster>(posterJsonUrl(id));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [imageAspect, setImageAspect] = React.useState(1055 / 1491);
  const viewport = useViewportSize();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const t = translations[locale];
  const viewerMargin = viewport.width < 560 ? 12 : 20;
  const fitWidth = Math.max(280, Math.min(viewport.width - viewerMargin * 2, (viewport.height - viewerMargin * 2) * imageAspect));
  const posterWidth = Math.round(fitWidth * zoom);

  React.useEffect(() => {
    return () => audioRef.current?.pause();
  }, []);

  function changeZoom(delta: number) {
    setZoom((current) => clamp(Math.round((current + delta) * 100) / 100, 0.5, 3));
  }

  async function playSection(section: PosterSection) {
    if (poster.status !== "ready") {
      return;
    }

    setActiveId(section.id);
    try {
      const audioUrl = isStaticPosters ? assetUrl(`/audio/${poster.data.id}/${section.id}.mp3`) : await requestAudioUrl(poster.data.id, section.id);

      audioRef.current?.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not play this section.");
    }
  }

  return (
    <main className="viewer-shell">
      <div className="viewer-controls">
        <button className="icon-button" onClick={() => navigate(`/${locale}`)} aria-label={t.backToGallery} title={t.backToGallery}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={() => changeZoom(-0.15)} aria-label={t.zoomOut} title={t.zoomOut}>
          <ZoomOut aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={() => setZoom(1)} aria-label={t.resetZoom} title={t.resetZoom}>
          <Maximize2 aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={() => changeZoom(0.15)} aria-label={t.zoomIn} title={t.zoomIn}>
          <ZoomIn aria-hidden="true" />
        </button>
      </div>

      {poster.status === "loading" && <Loading label={t.loadingPoster} />}
      {poster.status === "error" && <ErrorBox message={poster.error} />}
      {poster.status === "ready" && (
        <section className="poster-stage" style={{ width: `${posterWidth}px` }} aria-label={`${poster.data.title} interactive poster`}>
          <img
            className="poster-image"
            src={assetUrl(poster.data.image)}
            alt={poster.data.title}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                setImageAspect(image.naturalWidth / image.naturalHeight);
              }
            }}
          />
          {poster.data.sections.map((section) => (
            <button
              key={section.id}
              className={`hotspot ${activeId === section.id ? "is-active" : ""}`}
              style={{
                left: `${section.x}%`,
                top: `${section.y}%`,
                width: `${section.width}%`,
                height: `${section.height}%`
              }}
              onClick={() => playSection(section)}
              onFocus={() => setActiveId(section.id)}
              onMouseEnter={() => setActiveId(section.id)}
              aria-label={t.readSection(section.label)}
              title={section.label}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function useViewportSize() {
  const [size, setSize] = React.useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight
  }));

  React.useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseRoute(path: string): { kind: "gallery"; locale: Locale } | { kind: "poster"; locale: Locale; id: string } {
  const localeMatch = path.match(/^\/(de|en|uk)(?:\/poster\/([^/]+))?\/?$/);
  if (localeMatch) {
    return localeMatch[2]
      ? { kind: "poster", locale: localeMatch[1] as Locale, id: decodeURIComponent(localeMatch[2]) }
      : { kind: "gallery", locale: localeMatch[1] as Locale };
  }

  const legacyPosterMatch = path.match(/^\/poster\/([^/]+)$/);
  if (legacyPosterMatch) {
    return { kind: "poster", locale: "de", id: decodeURIComponent(legacyPosterMatch[1]) };
  }

  return { kind: "gallery", locale: "de" };
}

function posterLocale(poster: PosterSummary): Locale {
  if (poster.language?.startsWith("en")) {
    return "en";
  }
  if (poster.language?.startsWith("uk")) {
    return "uk";
  }
  return "de";
}

function getCurrentPath() {
  if (isStaticPosters) {
    const hashPath = window.location.hash.replace(/^#/, "");
    return hashPath.startsWith("/") ? hashPath : "/";
  }

  return window.location.pathname;
}

function assetUrl(value: string) {
  if (!isStaticPosters) {
    return value;
  }

  return `${baseUrl}${value.replace(/^\//, "")}`;
}

function posterIndexUrl() {
  return isStaticPosters ? assetUrl("/poster-assets/index.json") : "/api/posters";
}

function posterJsonUrl(id: string) {
  return isStaticPosters ? assetUrl(`/poster-assets/${encodeURIComponent(id)}/poster.json`) : `/api/posters/${encodeURIComponent(id)}`;
}

async function requestAudioUrl(posterId: string, sectionId: string) {
  const response = await fetch("/api/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posterId, sectionId })
  });
  const result = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !result.url) {
    throw new Error(result.error ?? "Could not play audio.");
  }

  return result.url;
}

function useJson<T>(url: string): LoadState<T> {
  const [state, setState] = React.useState<LoadState<T>>({ status: "loading" });

  React.useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? `Request failed with ${response.status}`);
        }
        return payload as T;
      })
      .then((data) => setState({ status: "ready", data }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", error: error instanceof Error ? error.message : "Request failed" });
        }
      });

    return () => controller.abort();
  }, [url]);

  return state;
}

function Loading({ label }: { label: string }) {
  return (
    <div className="loading">
      <Loader2 className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
