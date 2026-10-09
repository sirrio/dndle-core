# dndle-core

Shared React game shell for [Spelldle](https://sirrio.github.io/spelldle/) and [Critterdle](https://sirrio.github.io/critterdle/).

It provides the daily UTC puzzle selection, seven-guess board, comparison results, local statistics, result sharing, responsive layout, tooltips, and legal footer. Each game supplies its own entries, icons, comparison traits, copy, theme, and storage namespace.

Only submitted guesses appear in the results list. New guesses use a short entry
animation that respects reduced-motion preferences. Existing completed rounds
retain their original guess limit, and adding a seventh statistics bucket preserves
the previous distribution and streaks.

## License

MIT. Game data and icons remain licensed and attributed by the consuming game.
