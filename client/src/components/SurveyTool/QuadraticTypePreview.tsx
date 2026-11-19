import styles from './QuadraticTypePreview.module.scss';

/**
 * The picture of a quadratic question on a question-type tile; the tile's own label names the type.
 * `plain` draws it in the tile's own text colour, for tiles whose background changes (light, or dark once
 * pressed), where the create view's fixed colours would not show.
 */
export default function QuadraticTypePreview({ plain = false }: { plain?: boolean }) {
  return (
    <div
      className={`${styles.preview} ${plain ? styles.plain : ''}`}
      aria-hidden="true"
      data-testid="ce-quadratic-type-preview"
    >
      <span className={styles.step} data-step="down">
        −
      </span>
      <span className={styles.vote}>2</span>
      <span className={styles.step} data-step="up" data-active="true">
        +
      </span>
      <span className={styles.squares}>
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
