import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GameDialog } from "./GameDialog";
import { tryCopyText } from "./clipboard";
import { DEFAULT_MAX_GUESSES, nextGameStats, normalizeStats, resolveGuessLimit, roundOutcome } from "./game-state";

export type Result = "exact" | "partial" | "wrong" | "higher" | "lower";

export type DndleEntry = {
  name: string;
};

export type Trait<T extends DndleEntry> = {
  key: string;
  label: string;
  mobileLabel?: string;
  value: (entry: T) => string;
  compare: (guess: T, target: T) => Result;
};

export type DailySettings = {
  startUtc: [year: number, zeroBasedMonth: number, day: number];
  multiplier: number;
  offset: number;
};

export type DndleConfig<T extends DndleEntry> = {
  id: string;
  storageKey: string;
  brand: string;
  brandRune?: string;
  brandIconUrl?: string;
  tagline: string;
  entries: T[];
  traits: Trait<T>[];
  daily: DailySettings;
  itemLabel: string;
  collectionTitle?: string;
  archiveName: string;
  resultsTitle: string;
  selectPrompt: string;
  readyPrompt: string;
  actionLabel: string;
  howTitle: string;
  howIntro: string;
  howSteps: string[];
  arrowTraits: string;
  successKicker: (guesses: number) => string;
  failureKicker: string;
  nextLabel: string;
  shareQuestion: string;
  shareUrl: string;
  shareAction: string;
  relatedGame: {
    prompt: string;
    url: string;
  };
  resultSummary: (entry: T) => string;
  renderIcon: (entry?: T) => ReactNode;
  credits: ReactNode;
};

export function utcDayKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function dailyGameNumber(settings: DailySettings, date = new Date()) {
  const start = Date.UTC(...settings.startUtc);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - start) / 86400000) + 1;
}

export function dailyTarget<T>(entries: T[], settings: DailySettings, date = new Date()) {
  const number = dailyGameNumber(settings, date);
  return entries[(number * settings.multiplier + settings.offset) % entries.length];
}

export function compareText(value: string, target: string): Result {
  return value === target ? "exact" : "wrong";
}

export function compareList(value: string[], target: string[]): Result {
  if (value.length === target.length && value.every((entry) => target.includes(entry))) return "exact";
  return value.some((entry) => target.includes(entry)) ? "partial" : "wrong";
}

export function compareNumber(value: number, target: number): Result {
  if (value === target) return "exact";
  return value < target ? "higher" : "lower";
}

export function compareRank(value: number, target: number): Result {
  return compareNumber(value, target);
}

export function entryOptionDisabled(used: boolean, finished: boolean) {
  return used && !finished;
}

export function buildShareRow(results: Result[]) {
  return results.map((value) => value === "exact" ? "🟩" : value === "partial" ? "🟨" : value === "higher" ? "⬆️" : value === "lower" ? "⬇️" : "⬜").join("");
}

export function buildShareText({ brand, gameNumber, score, rows, question, action, url, relatedPrompt, relatedUrl }: {
  brand: string;
  gameNumber: number;
  score: string;
  rows: string[];
  question: string;
  action: string;
  url: string;
  relatedPrompt: string;
  relatedUrl: string;
}) {
  return `[${brand}](${url}) #${gameNumber} ${score}\n${rows.join("\n")}\n\n${question}\n[${action}](${url}) · [${relatedPrompt}](<${relatedUrl}>)`;
}

function Cell({ label, value, result }: { label: string; value: string; result: Result }) {
  const arrow = result === "higher" ? " ↑" : result === "lower" ? " ↓" : "";
  const accessible = result === "exact" ? "Exact match" : result === "partial" ? "Partial match" : result === "higher" ? "Target value is higher" : result === "lower" ? "Target value is lower" : "No match";
  return <div className={`result-cell ${result}`} title={accessible}><span className="mobile-label">{label}</span><strong>{value}{arrow}</strong></div>;
}

function comparison<T extends DndleEntry>(guess: T, target: T, traits: Trait<T>[]) {
  return traits.map((trait) => trait.compare(guess, target));
}

export function DailyDndle<T extends DndleEntry>({ config }: { config: DndleConfig<T> }) {
  const target = useMemo(() => dailyTarget(config.entries, config.daily), [config]);
  const gameNumber = dailyGameNumber(config.daily);
  const sortedEntries = useMemo(() => [...config.entries].sort((a, b) => a.name.localeCompare(b.name)), [config]);
  const [selectedName, setSelectedName] = useState("");
  const [guesses, setGuesses] = useState<T[]>([]);
  const [guessLimit, setGuessLimit] = useState(DEFAULT_MAX_GUESSES);
  const [roundReady, setRoundReady] = useState(false);
  const [newGuessName, setNewGuessName] = useState<string | null>(null);
  const newGuessRow = useRef<HTMLDivElement>(null);
  const archivePanel = useRef<HTMLElement>(null);
  const resultButton = useRef<HTMLButtonElement>(null);
  const [compactResults, setCompactResults] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);
  const [expandedGuess, setExpandedGuess] = useState<string | null | undefined>(undefined);
  const [showHow, setShowHow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState("");
  const shareTextField = useRef<HTMLTextAreaElement>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [stats, setStats] = useState(() => normalizeStats());
  const [countdown, setCountdown] = useState("");
  const [tooltip, setTooltip] = useState<{ name: string; left: number; top: number } | null>(null);
  const { won, finished } = roundOutcome(guesses.map((guess) => guess.name), target.name, guessLimit);
  const remainingGuesses = Math.max(0, guessLimit - guesses.length);
  const selectedEntry = config.entries.find((entry) => entry.name === selectedName);
  const visibleGuesses = compactResults ? [...guesses].reverse() : guesses;
  const expandedGuessName = expandedGuess === undefined ? guesses.at(-1)?.name : expandedGuess;

  useEffect(() => {
    if (shareFallback) shareTextField.current?.focus();
  }, [shareFallback]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setCompactResults(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const dayKey = utcDayKey();
    const saved = localStorage.getItem(`${config.storageKey}:${dayKey}`);
    const recorded = Boolean(localStorage.getItem(`${config.storageKey}:recorded:${dayKey}`));
    setGuessLimit(resolveGuessLimit(Number(localStorage.getItem(`${config.storageKey}:limit:${dayKey}`)), recorded));
    try {
      const names: unknown = JSON.parse(saved || "[]");
      if (Array.isArray(names)) setGuesses(names.map((name) => config.entries.find((entry) => entry.name === name)).filter(Boolean) as T[]);
    } catch { /* Ignore invalid local data. */ }
    setRoundReady(true);
  }, [config]);

  useEffect(() => {
    if (!roundReady || !guesses.length) return;
    const dayKey = utcDayKey();
    localStorage.setItem(`${config.storageKey}:limit:${dayKey}`, String(guessLimit));
    localStorage.setItem(`${config.storageKey}:${dayKey}`, JSON.stringify(guesses.map((guess) => guess.name)));
  }, [config.storageKey, guesses, guessLimit, roundReady]);

  useEffect(() => {
    if (!newGuessName) return;
    if (compactResults && !finished) newGuessRow.current?.querySelector<HTMLButtonElement>(".guess-summary")?.focus({ preventScroll: true });
    newGuessRow.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    const timer = window.setTimeout(() => setNewGuessName(null), 400);
    return () => window.clearTimeout(timer);
  }, [newGuessName]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${config.storageKey}:stats`);
      if (saved) setStats(normalizeStats(JSON.parse(saved)));
    } catch { /* Ignore invalid local data. */ }
    const initialDay = utcDayKey();
    const update = () => {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const seconds = Math.max(0, Math.floor((next - now.getTime()) / 1000));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      setCountdown(`${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`);
      if (utcDayKey() !== initialDay) window.location.reload();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [config.storageKey]);

  useEffect(() => {
    if (!roundReady || !finished) return;
    const recordKey = `${config.storageKey}:recorded:${utcDayKey()}`;
    if (localStorage.getItem(recordKey)) return;
    let current = normalizeStats();
    try { current = normalizeStats(JSON.parse(localStorage.getItem(`${config.storageKey}:stats`) || "{}")); } catch { /* Use defaults. */ }
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayKey = utcDayKey(yesterday);
    const next = nextGameStats(current, { won, guessCount: guesses.length, dayKey: utcDayKey(), yesterdayKey });
    localStorage.setItem(`${config.storageKey}:stats`, JSON.stringify(next));
    localStorage.setItem(recordKey, "1");
    setStats(next);
  }, [config.storageKey, finished, guesses.length, won, roundReady]);

  function submit() {
    if (!roundReady || finished) return;
    const guess = config.entries.find((entry) => entry.name.toLowerCase() === selectedName.trim().toLowerCase());
    if (!guess || guesses.some((entry) => entry.name === guess.name)) return;
    setGuesses((current) => [...current, guess]);
    setNewGuessName(guess.name);
    setExpandedGuess(guess.name);
    setTooltip(null);
    setSelectedName("");
    if (guess.name === target.name || guesses.length + 1 >= guessLimit) setResultDismissed(false);
  }

  async function share() {
    const rows = guesses.map((guess) => buildShareRow(comparison(guess, target, config.traits)));
    const text = buildShareText({
      brand: config.brand,
      gameNumber,
      score: `${won ? guesses.length : "X"}/${guessLimit}`,
      rows,
      question: config.shareQuestion,
      action: config.shareAction,
      url: config.shareUrl,
      relatedPrompt: config.relatedGame.prompt,
      relatedUrl: config.relatedGame.url,
    });
    setCopied(false);
    if (await tryCopyText(text, navigator.clipboard)) {
      setShareFallback("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setShareFallback(text);
      shareTextField.current?.focus();
    }
  }

  function showTooltip(element: HTMLElement, name: string) {
    const rect = element.getBoundingClientRect();
    const left = Math.max(110, Math.min(window.innerWidth - 110, rect.left + rect.width / 2));
    setTooltip({ name, left, top: rect.top - 8 });
  }

  function showEntryTooltip(element: HTMLElement, name: string) {
    const label = element.querySelector("strong");
    if (!showNames || (label && (label.scrollHeight > label.clientHeight || label.scrollWidth > label.clientWidth))) showTooltip(element, name);
    else setTooltip(null);
  }

  const gridStyle = { "--trait-count": config.traits.length + 1 } as CSSProperties;

  return (
    <main className={`${config.id}-theme`}>
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label={`${config.brand} home`}><span className="brand-rune">{config.brandIconUrl ? <img src={config.brandIconUrl} alt="" /> : config.brandRune}</span></a>
        <div className="game-tagline">{config.tagline}</div>
        <div className="header-actions">
          {finished && <button className="icon-button results-button" ref={resultButton} onClick={() => setResultDismissed(false)} aria-label="Open result and statistics">RESULT</button>}
          <button className="icon-button" onClick={() => setShowHow(true)} aria-label="Show game rules">?</button>
        </div>
      </header>

      {tooltip && <div id="entry-tooltip" className="spell-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.name}</div>}

      <section className="play-shell">
        <article className="archive-panel" ref={archivePanel} tabIndex={-1} aria-label={config.collectionTitle || config.itemLabel}>
          <div className="section-head"><h2>{config.collectionTitle || config.itemLabel}</h2><button className="name-toggle" type="button" aria-pressed={showNames} onClick={() => { setShowNames((current) => !current); setTooltip(null); }}>Show names</button></div>
          <div className={`spell-grid${showNames ? "" : " names-hidden"}`}>
            {sortedEntries.map((entry) => {
              const used = guesses.some((guess) => guess.name === entry.name);
              const selected = selectedName === entry.name;
              const found = won && entry.name === target.name;
              return <button className={`spell-option${selected ? " selected" : ""}${used ? " used" : ""}${found ? " found" : ""}${finished ? " locked" : ""}`} key={entry.name} onClick={() => { if (!used && !finished) setSelectedName(entry.name); }} onMouseEnter={(event) => showEntryTooltip(event.currentTarget, entry.name)} onMouseLeave={() => setTooltip(null)} onFocus={(event) => showEntryTooltip(event.currentTarget, entry.name)} onBlur={() => setTooltip(null)} disabled={entryOptionDisabled(used, finished)} aria-disabled={used || finished} aria-describedby={tooltip?.name === entry.name ? "entry-tooltip" : undefined} aria-label={entry.name} aria-pressed={selected}><span className="option-sigil">{config.renderIcon(entry)}</span>{showNames && <strong>{entry.name}</strong>}</button>;
            })}
          </div>
        </article>

        <div className="game-console">
          <section className={`selection-stage${selectedEntry ? " has-selection" : ""}`}>
            <div className={`selected-sigil${selectedEntry ? "" : " is-empty"}`} aria-hidden="true">{selectedEntry ? config.renderIcon(selectedEntry) : <span className="placeholder-glyph">{config.renderIcon()}</span>}</div>
            <div className="selected-copy"><h1>{selectedEntry?.name || `Choose a ${config.itemLabel.toLowerCase()}`}</h1><p>{selectedEntry ? config.readyPrompt : config.selectPrompt}</p></div>
            <button className="primary submit-guess" onClick={submit} disabled={!roundReady || !selectedName || finished}>{config.actionLabel}</button>
          </section>

          <article className="results-panel" aria-label="Your guesses">
            <div className="section-head results-head"><h2>{config.resultsTitle}</h2><span className="round-label" aria-label={`Daily puzzle ${gameNumber}`}>#{gameNumber}</span></div>
            {guesses.length > 0 && !finished && <button className="primary next-guess-button" type="button" onClick={() => {
              setTooltip(null);
              archivePanel.current?.focus({ preventScroll: true });
              archivePanel.current?.scrollIntoView({ block: "start", behavior: "instant" });
            }}>Choose next {config.itemLabel.toLowerCase()} ↑</button>}
            {guesses.length === 0 ? <p className="results-empty">Make your first guess to reveal the clues.</p> : <div className="table-scroll">
              <div className="table-head" style={gridStyle}><span>{config.itemLabel}</span>{config.traits.map((trait) => <span key={trait.key}>{trait.label}</span>)}</div>
              <div className="rows">
                {visibleGuesses.map((guess) => {
                  const results = comparison(guess, target, config.traits);
                  const solved = guess.name === target.name;
                  const number = guesses.indexOf(guess) + 1;
                  const expanded = guess.name === expandedGuessName;
                  const traitsId = `${config.id}-guess-${number}`;
                  return <div className={`result-row${solved ? " solved" : ""}${expanded ? "" : " is-collapsed"}${guess.name === newGuessName ? " is-new" : ""}`} key={guess.name} ref={guess.name === newGuessName ? newGuessRow : undefined} style={gridStyle}>
                    <button className="guess-summary" type="button" aria-expanded={expanded} aria-controls={traitsId} onClick={() => { setExpandedGuess(expanded ? null : guess.name); setTooltip(null); }}>
                      <span className="row-sigil" aria-hidden="true">{config.renderIcon(guess)}</span>
                      <span className="guess-summary-name">{guess.name}</span>
                      <span className="guess-number">#{number}</span>
                      <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                    </button>
                    <div className={`spell-cell${solved ? " exact" : ""}`} role="img" tabIndex={0} aria-label={guess.name} aria-describedby={tooltip?.name === guess.name ? "entry-tooltip" : undefined} onMouseEnter={(event) => showTooltip(event.currentTarget, guess.name)} onMouseLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget, guess.name)} onBlur={() => setTooltip(null)}><span className="row-sigil">{config.renderIcon(guess)}</span><span className="sr-only">{guess.name}</span></div>
                    <div className="guess-traits" id={traitsId}>{config.traits.map((trait, traitIndex) => <Cell key={trait.key} label={trait.mobileLabel || trait.label} value={trait.value(guess)} result={results[traitIndex]} />)}</div>
                  </div>;
                })}
              </div>
            </div>}
          </article>
          <p className="guesses-remaining" role="status">{won ? `Solved in ${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"}` : remainingGuesses ? `${remainingGuesses} ${remainingGuesses === 1 ? "guess" : "guesses"} remaining` : "No guesses remaining"}</p>
        </div>
      </section>

      {showHow && <GameDialog className="modal-backdrop" labelledBy="how-title" onClose={() => setShowHow(false)} closeOnBackdrop><div className="modal"><button className="modal-close" onClick={() => setShowHow(false)} aria-label="Close">×</button><div className="panel-kicker">HOW TO PLAY</div><h2 id="how-title">{config.howTitle}</h2><p className="how-intro">{config.howIntro}</p><div className="how-steps">{config.howSteps.map((step, index) => <div className="how-step" key={step}><strong>{index + 1}</strong><span>{step}</span></div>)}</div><div className="legend modal-legend"><span><i className="swatch exact" />Exact</span><span><i className="swatch partial" />Partial</span><span><i className="swatch wrong" />No match</span></div><p className="arrow-help">Arrows for {config.arrowTraits} point toward the target.</p><div className="credits"><strong>CONTENT &amp; ICON CREDITS</strong>{config.credits}</div></div></GameDialog>}

      {finished && !resultDismissed && <GameDialog className="result-backdrop" labelledBy="result-title" onClose={() => setResultDismissed(true)} returnFocus={() => resultButton.current}><section className="result-popup"><button className="popup-close" onClick={() => setResultDismissed(true)} aria-label="Close result">×</button><span className="reveal-sigil">{config.renderIcon(target)}</span><div className="result-kicker">{won ? config.successKicker(guesses.length) : config.failureKicker}</div><h2 id="result-title">{target.name}</h2><p>{config.resultSummary(target)}</p><div className="share-grid" style={{ gridTemplateColumns: `repeat(${config.traits.length}, 24px)` }} aria-label="Your result">{guesses.flatMap((guess) => comparison(guess, target, config.traits).map((value, index) => <i key={`${guess.name}-${index}`} className={`share-dot ${value}`} />))}</div><div className="next-game"><span>{config.nextLabel}</span><strong>{countdown}</strong></div><div className="result-actions"><button className="primary" onClick={share}>{copied ? "COPIED ✓" : "SHARE RESULT"}</button><button className="stats-button" onClick={() => setShowStats((value) => !value)}>{showStats ? "HIDE" : "STATISTICS"}</button></div>{shareFallback && <div className="share-fallback">
  <p id={`${config.id}-copy-help`} role="alert">Automatic copying wasn't available. Copy your result below.</p>
  <label htmlFor={`${config.id}-share-text`}>Your result</label>
  <textarea id={`${config.id}-share-text`} ref={shareTextField} readOnly value={shareFallback} aria-describedby={`${config.id}-copy-help`} onFocus={(event) => event.currentTarget.select()} />
</div>}{showStats && <div className="stats-drawer"><div className="stat"><strong>{stats.played}</strong><span>PLAYED</span></div><div className="stat"><strong>{stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%</strong><span>WON</span></div><div className="stat"><strong>{stats.wins ? (stats.totalGuesses / stats.wins).toFixed(1) : "–"}</strong><span>AVG. GUESSES</span></div><div className="stat"><strong>{stats.streak}</strong><span>STREAK</span></div><div className="distribution">{stats.distribution.map((value, index) => <div key={index}><span>{index + 1}</span><i style={{ width: `${Math.max(8, stats.wins ? (value / Math.max(...stats.distribution, 1)) * 100 : 8)}%` }}>{value}</i></div>)}</div></div>}</section></GameDialog>}
      <footer className="site-footer">A project by <a href="https://sirrio.de/" target="_blank" rel="noreferrer">sirrio.de</a><span aria-hidden="true">·</span><a href="https://sirrio.de/impressum/" target="_blank" rel="noreferrer">Impressum</a><span aria-hidden="true">·</span><a href="https://sirrio.de/datenschutz/" target="_blank" rel="noreferrer">Datenschutz</a></footer>
    </main>
  );
}
