// Purpose: Searchable borrower catalog split by regular and thesis books.
// Parts: local state, derived filtered lists, borrow/return/thesis handlers, modal render.
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import BookCard from "../../components/BookCard";
import BookDetailsModal from "../../components/BookDetailsModal";
import ThesisPermissionModal from "../../components/ThesisPermissionModal";
import {
  getBooks,
  borrowBook,
  requestBookReturn,
  getBorrowHistory,
  getBorrowRequestsByBorrower,
  cancelBorrowRequest
} from "../../services/bookService";
import { showError, showInfo, showSuccess } from "../../utils/notification";
import { useStore } from "../../store/useAuthStore";

const BrowseBooks = () => {
  const { user } = useStore();
  const [books, setBooks] = useState(getBooks());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [pendingThesisBookId, setPendingThesisBookId] = useState(null);
  const [permissionCode, setPermissionCode] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [borrowRequests, setBorrowRequests] = useState(
    () => getBorrowRequestsByBorrower(user?.email)
  );
  const [requestToCancel, setRequestToCancel] = useState(null);
  const [processingById, setProcessingById] = useState({});
  const [borrowHistoryVersion, setBorrowHistoryVersion] = useState(0);

  // Match query against title, author, or category in a case-insensitive way.
  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return books;

    return books.filter((book) =>
      [book.title, book.author, book.category, ...(book.keywords || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [books, searchQuery]);

  // Keep regular books and theses in separate sections for clearer UX.
  const regularBooks = useMemo(
    () =>
      filteredBooks.filter(
        (book) => String(book.category || "").toLowerCase() !== "thesis"
      ),
    [filteredBooks]
  );

  const thesisBooks = useMemo(
    () =>
      filteredBooks.filter(
        (book) => String(book.category || "").toLowerCase() === "thesis"
      ),
    [filteredBooks]
  );

  // Reload latest catalog state and current user's borrow requests after mutations.
  const refresh = () => {
    setBooks(getBooks());
    setBorrowRequests(getBorrowRequestsByBorrower(user?.email));
    setBorrowHistoryVersion((current) => current + 1);
  };

  const isProcessing = (id) => Boolean(processingById[id]);

  const markProcessing = (id, next) => {
    setProcessingById((current) => {
      if (next) {
        return { ...current, [id]: true };
      }
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  };

  const pendingRequestByBookId = useMemo(() => {
    const pendingMap = new Map();
    borrowRequests.forEach((request) => {
      if (request.status === "pending") {
        pendingMap.set(request.bookId, request);
      }
    });
    return pendingMap;
  }, [borrowRequests]);

  const pendingReturnRequestByBookId = useMemo(() => {
    const pendingMap = new Map();
    borrowRequests.forEach((request) => {
      if (request.status === "pending_return") {
        pendingMap.set(request.bookId, request);
      }
    });
    return pendingMap;
  }, [borrowRequests]);

  const recommendedBooksLine = useMemo(() => {
    const history = getBorrowHistory();
    // Recommendation seed is borrow frequency so repeated demand surfaces first.
    const borrowCountByTitle = history.reduce((summary, entry) => {
      if (String(entry.action || "").toUpperCase() !== "BORROW_BOOK") return summary;

      const title = String(entry.title || "").trim();
      if (!title) return summary;

      summary[title] = (summary[title] || 0) + 1;
      return summary;
    }, {});

    const topTitles = Object.entries(borrowCountByTitle)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([title]) => title);

    // Prefer popularity-based recommendations when history exists.
    if (topTitles.length > 0) {
      return topTitles.join(", ");
    }

    // Fallback keeps UI populated on fresh installs with no borrow history yet.
    return books
      .filter((book) => book.available)
      .slice(0, 3)
      .map((book) => book.title)
      .join(", ");
  }, [books, borrowHistoryVersion]);

  const submitBorrow = (id, code = "", handlers = {}) => {
    const { onError, onSuccess } = handlers;
    if (!user) return;
    if (isProcessing(id)) return;
    markProcessing(id, true);
    showInfo("Processing borrow request, please wait...");
    setTimeout(() => {
      const result = borrowBook(id, user.email, code);
      if (!result.ok) {
        showError(result.error);
        markProcessing(id, false);
        if (onError) onError(result);
        return;
      }

      showSuccess("Pending. Please pick it up at the library.");
      refresh();
      markProcessing(id, false);
      if (onSuccess) onSuccess(result);
    }, 500);
  };

  const handleBorrow = (book) => {
    if (!user) return;

    const pendingRequest = pendingRequestByBookId.get(book.id);
    if (pendingRequest) {
      setRequestToCancel(pendingRequest);
      return;
    }

    // Thesis items trigger permission-code modal instead of immediate borrow.
    const isThesis = String(book.category || "").toLowerCase() === "thesis";
    if (isThesis) {
      setPendingThesisBookId(book.id);
      setPermissionCode("");
      setPermissionError("");
      return;
    }

    // Non-thesis can be borrowed immediately.
    submitBorrow(book.id);
  };

  const handleThesisApply = () => {
    if (!pendingThesisBookId) return;

    submitBorrow(pendingThesisBookId, permissionCode, {
      onError: (result) => {
        setPermissionError(result?.error || "Unable to apply for this thesis.");
      },
      onSuccess: () => {
        setPendingThesisBookId(null);
        setPermissionCode("");
        setPermissionError("");
      }
    });
  };

  const handleReturn = (id) => {
    if (!user) return;
    if (isProcessing(id)) return;
    markProcessing(id, true);
    // Return flow now starts with a borrower request that staff confirms.
    showInfo("Submitting return request, please wait...");
    setTimeout(() => {
      const result = requestBookReturn(id, user.email);
      if (!result.ok) {
        showError(result.error);
        markProcessing(id, false);
        return;
      }

      showSuccess("Return request submitted. Please wait for staff confirmation.");
      refresh();
      markProcessing(id, false);
    }, 500);
  };

  const handleCancelPendingRequest = () => {
    if (!requestToCancel || !user) return;
    if (isProcessing(requestToCancel.bookId)) return;
    markProcessing(requestToCancel.bookId, true);
    showInfo("Cancelling borrow request, please wait...");
    // LOGIC: Delay keeps cancel action behavior aligned with borrow/return timing
    // and gives users a visible processing state before state refresh.
    setTimeout(() => {
      const result = cancelBorrowRequest(requestToCancel.id, user.email);
      if (!result.ok) {
        showError(result.error || "Unable to cancel borrow request.");
        markProcessing(requestToCancel.bookId, false);
        return;
      }

      showSuccess("Borrow request cancelled.");
      setRequestToCancel(null);
      refresh();
      markProcessing(requestToCancel.bookId, false);
    }, 500);
  };

  const handleCategoryToggle = (category) => {
    setSelectedCategory((current) => (current === category ? null : category));
  };

  return (
    <section className="browse-books-page">
      <div className="page-header">
        <div>
          <h2>Browse Books</h2>
          <p className="muted">Pick a title and borrow instantly.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>
          <strong>Recommended Books:</strong>{" "}
          {recommendedBooksLine || "No recommendations available yet."}
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="search-input-wrapper">
          <Search className="search-input-icon" size={18} aria-hidden="true" />
          <input
            className="input search-input"
            type="search"
            aria-label="Search books by title, author, or category"
            placeholder="Search by title, author, or category"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="book-category-filter" role="group" aria-label="Book category filter">
          <button
            type="button"
            aria-pressed={selectedCategory === "general"}
            className={`btn btn--ghost${
              selectedCategory === "general" ? " book-category-filter__btn--active" : ""
            }`}
            onClick={() => handleCategoryToggle("general")}
          >
            {selectedCategory === "general" ? "✓ General Books" : "General Books"}
          </button>
          <button
            type="button"
            aria-pressed={selectedCategory === "thesis"}
            className={`btn btn--ghost${
              selectedCategory === "thesis" ? " book-category-filter__btn--active" : ""
            }`}
            onClick={() => handleCategoryToggle("thesis")}
          >
            {selectedCategory === "thesis" ? "✓ Thesis Books" : "Thesis Books"}
          </button>
        </div>
      </div>

      {filteredBooks.length === 0 ? (
        <div className="empty-state">No books found for your search.</div>
      ) : null}

      {selectedCategory === null || selectedCategory === "general" ? (
        <div className="book-grid">
          {regularBooks.map((book) => (
            // A pending request keeps the same primary action clickable for cancellation.
            <BookCard
              key={book.id}
              book={book}
              isProcessing={isProcessing(book.id)}
              canBorrow={book.available}
              isPending={pendingRequestByBookId.has(book.id)}
              borrowLabel={pendingRequestByBookId.has(book.id) ? "Pending" : undefined}
              pendingMessage={
                pendingRequestByBookId.has(book.id)
                  ? "Please pick it up at the library."
                  : undefined
              }
              returnLabel={
                pendingReturnRequestByBookId.has(book.id) ? "Pending Return" : "Return"
              }
              returnMessage={
                pendingReturnRequestByBookId.has(book.id)
                  ? "Waiting for staff confirmation."
                  : undefined
              }
              canReturn={
                !book.available &&
                book.borrowedBy === user?.email &&
                !pendingReturnRequestByBookId.has(book.id)
              }
              onBorrow={handleBorrow}
              onReturn={handleReturn}
              onOpenDetails={setSelectedBook}
            />
          ))}
        </div>
      ) : null}

      {selectedCategory === null && regularBooks.length > 0 && thesisBooks.length > 0 ? (
        <div className="book-section-separator" aria-hidden="true" />
      ) : null}

      {selectedCategory === null || selectedCategory === "thesis" ? (
        <div className="book-grid">
          {thesisBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isProcessing={isProcessing(book.id)}
              canBorrow={book.available}
              isPending={pendingRequestByBookId.has(book.id)}
              borrowLabel={pendingRequestByBookId.has(book.id) ? "Pending" : undefined}
              pendingMessage={
                pendingRequestByBookId.has(book.id)
                  ? "Please pick it up at the library."
                  : undefined
              }
              returnLabel={
                pendingReturnRequestByBookId.has(book.id) ? "Pending Return" : "Return"
              }
              returnMessage={
                pendingReturnRequestByBookId.has(book.id)
                  ? "Waiting for staff confirmation."
                  : undefined
              }
              canReturn={
                !book.available &&
                book.borrowedBy === user?.email &&
                !pendingReturnRequestByBookId.has(book.id)
              }
              onBorrow={handleBorrow}
              onReturn={handleReturn}
              onOpenDetails={setSelectedBook}
            />
          ))}
        </div>
      ) : null}

      <BookDetailsModal
        isOpen={Boolean(selectedBook)}
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />

      <ThesisPermissionModal
        isOpen={Boolean(pendingThesisBookId)}
        code={permissionCode}
        error={permissionError}
        onCodeChange={(value) => {
          setPermissionCode(value);
          if (permissionError) setPermissionError("");
        }}
        onCancel={() => {
          setPendingThesisBookId(null);
          setPermissionCode("");
          setPermissionError("");
        }}
        onSubmit={handleThesisApply}
      />

      {requestToCancel ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="card modal-card">
            <h3>Cancel Pending Borrow Request</h3>
            <p className="muted">Do you want to cancel this pending borrow request?</p>
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setRequestToCancel(null)}>
                Keep Pending
              </button>
              <button
                className="btn btn--danger"
                onClick={handleCancelPendingRequest}
                disabled={isProcessing(requestToCancel.bookId)}
              >
                Cancel Request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default BrowseBooks;
