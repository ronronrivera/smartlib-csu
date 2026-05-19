
import { useEffect, useMemo, useState, useCallback } from "react";
import { Search } from "lucide-react";
import BookCard from "../../components/BookCard";
import BookDetailsModal from "../../components/BookDetailsModal";
import ThesisPermissionModal from "../../components/ThesisPermissionModal";
import { showError, showInfo, showSuccess } from "../../utils/notification";
import { useStore } from "../../store/useAuthStore";
import useItems from "../../store/useItemsStore";
import { useRequest } from "../../store/useRequestsStore";

const normalizeKeywordTokens = (keywords) => {
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

const isBookAvailable = (book) => {
    const totalFromDb = Number(book?.total_copies);
    const totalCopies = Number.isInteger(totalFromDb) && totalFromDb > 0
        ? totalFromDb
        : (String(book?.item_type || "").toLowerCase() === "thesis" ? 1 : 3);

    const availableFromDb = Number(book?.available_copies);
    if (Number.isInteger(availableFromDb)) {
        return availableFromDb > 0;
    }

    return Boolean(book?.is_available) && totalCopies > 0;
};

const BrowseBooks = () => {
    const { user } = useStore();
    const { books, fetchBooks } = useItems();
    const { sendRequest, cancelBorrowRequest, itemRequests, fetchHistory } = useRequest();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null); // null | "general" | "thesis"

    const [pendingThesisBookId, setPendingThesisBookId] = useState(null);
    const [permissionCode, setPermissionCode] = useState("");
    const [permissionError, setPermissionError] = useState("");

    const [selectedBook, setSelectedBook] = useState(null);

    const [borrowRequests, setBorrowRequests] = useState([]);
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [borrowHistory, setBorrowHistory] = useState([]);

    const [processingById, setProcessingById] = useState({});

    const isProcessing = (id) => Boolean(processingById[id]);

    const markProcessing = (id, next) => {
        setProcessingById((current) => {
            if (next) return { ...current, [id]: true };
            const { [id]: _removed, ...rest } = current;
            return rest;
        });
    };

    const currentUserId = user?.profile?.user_id || user?.user?.id || null;

    const loadBorrowRequests = useCallback(async () => {
        if (!currentUserId) {
            setBorrowRequests([]);
            return;
        }

        try {
            await fetchHistory();
            const currentRequests = useRequest.getState().itemRequests || [];
            const myRequests = currentRequests.filter((request) => request.student_user_id === currentUserId);
            setBorrowRequests(myRequests);
        } catch (err) {
            setBorrowRequests([]);
            console.error(err);
            showError(err?.message || "Unable to load borrow requests.");
        }
    }, [currentUserId, fetchHistory]);

    const loadBorrowHistory = useCallback(async () => {
        try {
            await fetchHistory();
            const currentRequests = useRequest.getState().itemRequests || [];
            setBorrowHistory(currentRequests);
        } catch (err) {
                setBorrowHistory([]);
                console.error(err);
            }
    }, [fetchHistory]);

    const refresh = useCallback(async () => {
        await loadBorrowRequests();
        await loadBorrowHistory();
    }, [loadBorrowRequests, loadBorrowHistory]);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const filteredBooks = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return books;

        return books.filter((book) => {
            const searchTerms = [
                book.title,
                book.author,
                book.description,
                book.category,
                book.item_type,
                ...normalizeKeywordTokens(book.keywords),
            ];

            return searchTerms
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [books, searchQuery]);

    const regularBooks = useMemo(() => {
        const regular = filteredBooks.filter((book) => String(book.item_type || "").toLowerCase() !== "thesis");
        return regular.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }, [filteredBooks]);

    const thesisBooks = useMemo(() => {
        const thesis = filteredBooks.filter((book) => String(book.item_type || "").toLowerCase() === "thesis");
        return thesis.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }, [filteredBooks]);

    const pendingRequestByBookId = useMemo(() => {
        const pendingMap = new Map();
        borrowRequests.forEach((request) => {
            const itemId = request.library_item_id || request.bookId;
            if (request.status === "pending" && itemId) pendingMap.set(itemId, request);
        });
        return pendingMap;
    }, [borrowRequests]);

    const approvedBorrowByBookId = useMemo(() => {
        const approvedMap = new Map();
        borrowRequests.forEach((request) => {
            const itemId = request.library_item_id || request.bookId;
            if (String(request.status || "").toLowerCase() === "approved" && itemId) {
                approvedMap.set(itemId, request);
            }
        });
        return approvedMap;
    }, [borrowRequests]);

    const recommendedBooksLine = useMemo(() => {
        const borrowCountByTitle = borrowHistory.reduce((summary, entry) => {
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

        if (topTitles.length > 0) return topTitles.join(", ");

        return books
            .filter((book) => isBookAvailable(book))
            .slice(0, 3)
            .map((book) => book.title)
            .join(", ");
    }, [books, borrowHistory]);

    const submitBorrow = async (id, handlers = {}) => {
        const { onError, onSuccess } = handlers;

        if (!user?.user?.email) return;
        if (isProcessing(id)) return;

        markProcessing(id, true);
        showInfo("Processing borrow request, please wait...");

        try {
            // Find the book to get its title
            const book = books.find((b) => b.id === id);
            if (!book) {
                throw new Error("Book not found");
            }
            // Use the sendRequest function from useRequest store
            await sendRequest(book.title, book.item_type, id);

            // Give time for success message to show before refresh
            await new Promise(resolve => setTimeout(resolve, 500));
            await refresh();
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            const errorMsg = err?.response?.data?.message || err?.message || "Unable to borrow book.";
            if (onError) onError({ ok: false, error: errorMsg });
        } finally {
            markProcessing(id, false);
        }
    };

    const handleBorrow = (book) => {

        const pendingRequest = pendingRequestByBookId.get(book.id);

        if (pendingRequest) {
            return;
        }


        const isThesis = String(book.item_type || "").toLowerCase() === "thesis";
        if (isThesis) {
            setPendingThesisBookId(book.id);
            setPermissionCode("");
            setPermissionError("");
            return;
        }
        

        submitBorrow(book.id);
    };

    const handleThesisApply = () => {
        if (!pendingThesisBookId) return;

        submitBorrow(pendingThesisBookId, {
            onError: (result) => {
                setPermissionError(result?.error || "Unable to apply for this thesis.");
            },
            onSuccess: () => {
                setPendingThesisBookId(null);
                setPermissionCode("");
                setPermissionError("");
            },
        });
    };

    const handleCancelPendingRequest = async () => {
        if (!requestToCancel || !user?.email) return;

        const bookId = requestToCancel.bookId;
        if (isProcessing(bookId)) return;

        markProcessing(bookId, true);
        showInfo("Cancelling borrow request, please wait...");

        try {
            await cancelBorrowRequest(requestToCancel.id);

            showSuccess("Borrow request cancelled.");
            setRequestToCancel(null);
            await refresh();
        } catch (err) {
            console.error(err);
            const errorMsg = err?.response?.data?.message || err?.message || "Unable to cancel borrow request.";
            showError(errorMsg);
        } finally {
            markProcessing(bookId, false);
        }
    };

    const handleCategoryToggle = (category) => {
        setSelectedCategory((current) => (current === category ? null : category));
    };

    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchHistory();
            fetchBooks();
        }, 3000);

        return () => clearInterval(intervalId);
    }, [fetchBooks, fetchHistory]);

    useEffect(() => {
        if (!currentUserId) {
            setBorrowRequests([]);
            return;
        }

        const requests = Array.isArray(itemRequests)
            ? itemRequests.filter((request) => request.student_user_id === currentUserId)
            : [];

        setBorrowRequests(requests);
    }, [currentUserId, itemRequests]);

    const renderBookGrid = (list) => (
        <div className="book-grid">
            {list.map((book) => {
                const bookId = book.id;
                const hasPendingBorrow = pendingRequestByBookId.has(bookId);
                const hasApprovedBorrow = approvedBorrowByBookId.has(bookId);

                return (
                    <BookCard
                        key={bookId}
                        book={book}
                        isProcessing={isProcessing(bookId)}
                        canBorrow={isBookAvailable(book)}
                        isPending={hasPendingBorrow}
                        isBorrowed={hasApprovedBorrow}
                        borrowLabel={hasApprovedBorrow ? "Borrowed" : (hasPendingBorrow ? "Pending" : undefined)}
                        pendingMessage={hasPendingBorrow ? "Please pick it up at the library." : undefined}
                        onBorrow={handleBorrow}
                        onOpenDetails={setSelectedBook}
                    />
                );
            })}
        </div>
    );

    const renderThesisScroller = (list) => (
        <div className="book-grid book-grid--thesis-scroller">
            {list.map((book) => {
                const bookId = book.id;
                const hasPendingBorrow = pendingRequestByBookId.has(bookId);
                const hasApprovedBorrow = approvedBorrowByBookId.has(bookId);

                return (
                    <BookCard
                        key={bookId}
                        book={book}
                        isProcessing={isProcessing(bookId)}
                        canBorrow={isBookAvailable(book)}
                        isPending={hasPendingBorrow}
                        isBorrowed={hasApprovedBorrow}
                        borrowLabel={hasApprovedBorrow ? "Borrowed" : (hasPendingBorrow ? "Pending" : undefined)}
                        pendingMessage={hasPendingBorrow ? "Please pick it up at the library." : undefined}
                        onBorrow={handleBorrow}
                        onOpenDetails={setSelectedBook}
                    />
                );
            })}
        </div>
    );

    return (
        <section className="browse-books-page">
            <div className="page-header">
                <div>
                    <h2>Browse Books</h2>
                    <p className="muted">Pick a title and borrow instantly.</p>
                </div>
            </div>

            <div className="card browse-recommend-card">
                <p>
                    <strong>Recommended Books:</strong>{" "}
                    {recommendedBooksLine || "No recommendations available yet."}
                </p>
            </div>

            <div className="card browse-tools-card">
                <div className="search-input-wrapper">
                    <Search className="search-input-icon" size={18} aria-hidden="true" />
                    <input
                        className="input search-input"
                        type="search"
                        aria-label="Search books by title, author, category, item type, or keywords"
                        placeholder="Search by title, description subject, category, or keywords"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="book-category-filter" role="group" aria-label="Book category filter">
                    <div className="book-category-filter__tabs">
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
            </div>

            {filteredBooks.length === 0 ? (
                <div className="empty-state">No books found for your search.</div>
            ) : null}

            {selectedCategory === null || selectedCategory === "general" ? (
                <>
                    <div className="page-header page-header--thesis-scroller">
                        <div>
                            <h2>General Book Collection</h2>
                        </div>
                    </div>
                    {renderBookGrid(regularBooks)}
                </>
            ) : null}

            {(selectedCategory === null || selectedCategory === "thesis") && thesisBooks.length > 0 ? (
                <>
                    <div className="book-section-separator" aria-hidden="true" />
                    <div className="page-header page-header--thesis-scroller">
                        <div>
                            <h2>Thesis Collection</h2>
                        </div>
                    </div>
                    {renderThesisScroller(thesisBooks)}
                </>
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
                                className="btn btn--danger btn--cancel"
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
