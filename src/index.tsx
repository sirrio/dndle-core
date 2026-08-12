import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

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
    label: string;
    url: string;
  };
  resultSummary: (entry: T) => string;
  renderIcon: (entry?: T) => ReactNode;
  credits: ReactNode;
};

type GameStats = {
  played: number;
  wins: number;
  totalGuesses: number;
  streak: number;
  lastWin: string;
  distribution: number[];
};

const MAX_GUESSES = 6;
const EMPTY_STATS: GameStats = { played: 0, wins: 0, totalGuesses: 0, streak: 0, lastWin: "", distribution: [0, 0, 0, 0, 0, 0] };

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

export function buildShareText({ brand, gameNumber, score, rows, question, action, url, relatedPrompt, relatedLabel, relatedUrl }: {
  brand: string;
  gameNumber: number;
  score: string;
  rows: string[];
  question: string;
  action: string;
  url: string;
  relatedPrompt: string;
  relatedLabel: string;
  relatedUrl: string;
}) {
  return `[${brand}](${url}) #${gameNumber} ${score}\n${rows.join("\n")}\n\n${question}\n[${action}](${url})\n\n${relatedPrompt}\n[${relatedLabel}](${relatedUrl})`;
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
  const [showHow, setShowHow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [countdown, setCountdown] = useState("");
  const [tooltip, setTooltip] = useState<{ name: string; left: number; top: number } | null>(null);
  const won = guesses.some((guess) => guess.name === target.name);
  const finished = won || guesses.length >= MAX_GUESSES;
  const selectedEntry = config.entries.find((entry) => entry.name === selectedName);

  useEffect(() => {
    const saved = localStorage.getItem(`${config.storageKey}:${utcDayKey()}`);
    if (!saved) return;
    try {
      const names = JSON.parse(saved) as string[];
      setGuesses(names.map((name) => config.entries.find((entry) => entry.name === name)).filter(Boolean) as T[]);
    } catch { /* Ignore invalid local data. */ }
  }, [config]);

  useEffect(() => {
    if (guesses.length) localStorage.setItem(`${config.storageKey}:${utcDayKey()}`, JSON.stringify(guesses.map((guess) => guess.name)));
  }, [config.storageKey, guesses]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${config.storageKey}:stats`);
      if (saved) setStats({ ...EMPTY_STATS, ...JSON.parse(saved) });
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
    if (!finished) return;
    const recordKey = `${config.storageKey}:recorded:${utcDayKey()}`;
    if (localStorage.getItem(recordKey)) return;
    let current = EMPTY_STATS;
    try { current = { ...EMPTY_STATS, ...JSON.parse(localStorage.getItem(`${config.storageKey}:stats`) || "{}") }; } catch { /* Use defaults. */ }
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayKey = utcDayKey(yesterday);
    const next: GameStats = {
      ...current,
      played: current.played + 1,
      wins: current.wins + (won ? 1 : 0),
      totalGuesses: current.totalGuesses + (won ? guesses.length : 0),
      streak: won ? (current.lastWin === yesterdayKey ? current.streak + 1 : 1) : 0,
      lastWin: won ? utcDayKey() : current.lastWin,
      distribution: current.distribution.map((value, index) => value + (won && index === guesses.length - 1 ? 1 : 0)),
    };
    localStorage.setItem(`${config.storageKey}:stats`, JSON.stringify(next));
    localStorage.setItem(recordKey, "1");
    setStats(next);
  }, [config.storageKey, finished, guesses.length, won]);

  function submit() {
    if (finished) return;
    const guess = config.entries.find((entry) => entry.name.toLowerCase() === selectedName.trim().toLowerCase());
    if (!guess || guesses.some((entry) => entry.name === guess.name)) return;
    setGuesses((current) => [...current, guess]);
    setSelectedName("");
    if (guess.name === target.name || guesses.length + 1 >= MAX_GUESSES) setResultDismissed(false);
  }

  async function share() {
    const rows = guesses.map((guess) => comparison(guess, target, config.traits).map((value) => value === "exact" ? "🟩" : value === "partial" ? "🟨" : value === "higher" ? "⬆️" : value === "lower" ? "⬇️" : "⬛").join(""));
    const text = buildShareText({
      brand: config.brand,
      gameNumber,
      score: `${won ? guesses.length : "X"}/${MAX_GUESSES}`,
      rows,
      question: config.shareQuestion,
      action: config.shareAction,
      url: config.shareUrl,
      relatedPrompt: config.relatedGame.prompt,
      relatedLabel: config.relatedGame.label,
      relatedUrl: config.relatedGame.url,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function showTooltip(element: HTMLElement, name: string) {
    const rect = element.getBoundingClientRect();
    const left = Math.max(110, Math.min(window.innerWidth - 110, rect.left + rect.width / 2));
    setTooltip({ name, left, top: rect.top - 8 });
  }

  const gridStyle = { "--trait-count": config.traits.length + 1 } as CSSProperties;

  return (
    <main className={`${config.id}-theme`}>
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label={`${config.brand} home`}><span className="brand-rune">{config.brandIconUrl ? <img src={config.brandIconUrl} alt="" /> : config.brandRune}</span></a>
        <div className="game-tagline">{config.tagline}</div>
        <div className="header-actions">
          <div className="attempts"><strong>{guesses.length}</strong><span>/ {MAX_GUESSES}</span></div>
          {finished && <button className="icon-button results-button" onClick={() => setResultDismissed(false)} aria-label="Open result and statistics">RESULT</button>}
          <button className="icon-button" onClick={() => setShowHow(true)} aria-label="Show game rules">?</button>
        </div>
      </header>

      {tooltip && <div id="entry-tooltip" className="spell-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.name}</div>}

      <section className="play-shell">
        <article className="archive-panel">
          <div className="section-head"><div><span className="tiny-label">CHOOSE A</span><h2>{config.itemLabel}</h2></div><button className="name-toggle" type="button" aria-pressed={showNames} onClick={() => { setShowNames((current) => !current); setTooltip(null); }}><span>Names</span><strong>{showNames ? "On" : "Off"}</strong></button></div>
          <div className={`spell-grid${showNames ? "" : " names-hidden"}`}>
            {sortedEntries.map((entry) => {
              const used = guesses.some((guess) => guess.name === entry.name);
              const selected = selectedName === entry.name;
              const found = won && entry.name === target.name;
              return <button className={`spell-option${selected ? " selected" : ""}${used ? " used" : ""}${found ? " found" : ""}`} key={entry.name} onClick={() => { if (!used && !finished) setSelectedName(entry.name); }} onMouseEnter={showNames ? undefined : (event) => showTooltip(event.currentTarget, entry.name)} onMouseLeave={showNames ? undefined : () => setTooltip(null)} onFocus={showNames ? undefined : (event) => showTooltip(event.currentTarget, entry.name)} onBlur={showNames ? undefined : () => setTooltip(null)} disabled={used || finished} aria-describedby={!showNames && tooltip?.name === entry.name ? "entry-tooltip" : undefined} aria-label={entry.name} aria-pressed={selected}><span className="option-sigil">{config.renderIcon(entry)}</span>{showNames && <strong>{entry.name}</strong>}</button>;
            })}
          </div>
        </article>

        <div className="game-console">
          <section className={`selection-stage${selectedEntry ? " has-selection" : ""}`}>
            <div className="selected-sigil" aria-hidden="true">{config.renderIcon(selectedEntry)}</div>
            <div className="selected-copy"><span className="tiny-label">YOUR GUESS</span><h1>{selectedEntry?.name || `Choose a ${config.itemLabel.toLowerCase()}`}</h1><p>{selectedEntry ? config.readyPrompt : config.selectPrompt}</p></div>
            <button className="primary submit-guess" onClick={submit} disabled={!selectedName || finished}>{config.actionLabel}</button>
          </section>

          <article className="results-panel" aria-label="Your guesses">
            <div className="section-head results-head"><div><span className="tiny-label">{config.archiveName} #{gameNumber}</span><h2>{config.resultsTitle}</h2></div></div>
            <div className="table-scroll">
              <div className="table-head" style={gridStyle}><span>{config.itemLabel}</span>{config.traits.map((trait) => <span key={trait.key}>{trait.label}</span>)}</div>
              <div className="rows">
                {guesses.map((guess, index) => {
                  const results = comparison(guess, target, config.traits);
                  const solved = guess.name === target.name;
                  return <div className={`result-row${solved ? " solved" : ""}`} key={guess.name} style={{ ...gridStyle, animationDelay: `${index * 40}ms` }}><div className={`spell-cell${solved ? " exact" : ""}`} role="img" tabIndex={0} aria-label={guess.name} aria-describedby={tooltip?.name === guess.name ? "entry-tooltip" : undefined} onMouseEnter={(event) => showTooltip(event.currentTarget, guess.name)} onMouseLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget, guess.name)} onBlur={() => setTooltip(null)}><span className="row-sigil">{config.renderIcon(guess)}</span><span className="sr-only">{guess.name}</span></div>{config.traits.map((trait, traitIndex) => <Cell key={trait.key} label={trait.mobileLabel || trait.label} value={trait.value(guess)} result={results[traitIndex]} />)}</div>;
                })}
                {Array.from({ length: Math.max(0, MAX_GUESSES - guesses.length) }).map((_, index) => <div className="empty-row" style={gridStyle} key={index}><span>{guesses.length + index + 1}</span>{config.traits.map((trait) => <i key={trait.key} />)}</div>)}
              </div>
            </div>
          </article>
        </div>
      </section>

      {showHow && <div className="modal-backdrop" onMouseDown={() => setShowHow(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="how-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowHow(false)} aria-label="Close">×</button><div className="panel-kicker">HOW TO PLAY</div><h2 id="how-title">{config.howTitle}</h2><p className="how-intro">{config.howIntro}</p><div className="how-steps">{config.howSteps.map((step, index) => <div className="how-step" key={step}><strong>{index + 1}</strong><span>{step}</span></div>)}</div><div className="legend modal-legend"><span><i className="swatch exact" />Exact</span><span><i className="swatch partial" />Partial</span><span><i className="swatch wrong" />No match</span></div><p className="arrow-help">Arrows for {config.arrowTraits} point toward the target.</p><div className="credits"><strong>CONTENT &amp; ICON CREDITS</strong>{config.credits}</div></div></div>}

      {finished && !resultDismissed && <div className="result-backdrop" role="presentation"><section className="result-popup" role="dialog" aria-modal="true" aria-labelledby="result-title"><button className="popup-close" onClick={() => setResultDismissed(true)} aria-label="Close result">×</button><span className="reveal-sigil">{config.renderIcon(target)}</span><div className="result-kicker">{won ? config.successKicker(guesses.length) : config.failureKicker}</div><h2 id="result-title">{target.name}</h2><p>{config.resultSummary(target)}</p><div className="share-grid" style={{ gridTemplateColumns: `repeat(${config.traits.length}, 24px)` }} aria-label="Your result">{guesses.flatMap((guess) => comparison(guess, target, config.traits).map((value, index) => <i key={`${guess.name}-${index}`} className={`share-dot ${value}`} />))}</div><div className="next-game"><span>{config.nextLabel}</span><strong>{countdown}</strong></div><div className="result-actions"><button className="primary" onClick={share}>{copied ? "COPIED ✓" : "SHARE RESULT"}</button><button className="stats-button" onClick={() => setShowStats((value) => !value)}>{showStats ? "HIDE" : "STATISTICS"}</button></div>{showStats && <div className="stats-drawer"><div className="stat"><strong>{stats.played}</strong><span>PLAYED</span></div><div className="stat"><strong>{stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%</strong><span>WON</span></div><div className="stat"><strong>{stats.wins ? (stats.totalGuesses / stats.wins).toFixed(1) : "–"}</strong><span>AVG. GUESSES</span></div><div className="stat"><strong>{stats.streak}</strong><span>STREAK</span></div><div className="distribution">{stats.distribution.map((value, index) => <div key={index}><span>{index + 1}</span><i style={{ width: `${Math.max(8, stats.wins ? (value / Math.max(...stats.distribution, 1)) * 100 : 8)}%` }}>{value}</i></div>)}</div></div>}</section></div>}
      <footer className="site-footer">A project by <a href="https://sirrio.de/" target="_blank" rel="noreferrer">sirrio.de</a><span aria-hidden="true">·</span><a href="https://sirrio.de/impressum/" target="_blank" rel="noreferrer">Impressum</a><span aria-hidden="true">·</span><a href="https://sirrio.de/datenschutz/" target="_blank" rel="noreferrer">Datenschutz</a></footer>
    </main>
  );
}
