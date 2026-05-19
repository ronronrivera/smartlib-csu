// Purpose: Modal view that shows full details of a selected book.
// Parts: open/close guard, details content, modal actions.
import { useEffect } from "react";
const normalizeKeywords = (keywords) => {
  if (Array.isArray(keywords)) {
    return keywords
      .map((keyword) => String(keyword || "").trim())
      .filter(Boolean);
  }

  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
};

const BookDetailsModal = ({ isOpen, book, onClose }) => {
  useEffect(() => {
    if (!isOpen || !book) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [book, isOpen, onClose]);

  // Prevent rendering when modal is closed or no selected book exists.
  if (!isOpen || !book) return null;

  const keywordTokens = normalizeKeywords(book.keywords);
  const categoryTokens = book.category 
    ? (Array.isArray(book.category) 
        ? book.category.map((cat) => String(cat || "").trim()).filter(Boolean)
        : String(book.category || "").split(",").map((cat) => cat.trim()).filter(Boolean))
    : [];
  const description = String(book.description || "").trim();

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="card modal-card modal-card--book-details">
        <h3 className="book-details__title">
          <strong>{(book.title || "").toUpperCase()}</strong>
        </h3>
        
        <p className="book-card__field book-details__author">
          <strong className="book-card__label">Author:</strong> <span>{book.author || "N/A"}</span>
        </p>

        <div className="book-card__field">
          <strong className="book-card__label">Keywords:</strong>
          {keywordTokens.length > 0 ? (
            <div className="book-card__keyword-list" aria-label="Book keywords">
              {keywordTokens.map((keyword) => (
                <span key={keyword} className="book-card__keyword-chip">{keyword}</span>
              ))}
            </div>
          ) : (
            <span className="muted"> N/A</span>
          )}
        </div>

        {categoryTokens.length > 0 ? (
          <div className="book-card__field">
            <strong className="book-card__label">Categories:</strong>
            <div className="book-card__keyword-list" aria-label="Book categories">
              {categoryTokens.map((category) => (
                <span key={category} className="book-card__keyword-chip">{category}</span>
              ))}
            </div>
          </div>
        ) : null}

        {description ? (
          <p className="book-card__field detail-card__desc">
            <strong className="book-card__label">Description:</strong> <span>{description}</span>
          </p>
        ) : null}
        <button className="btn btn--danger" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default BookDetailsModal;
