import { useMemo, useState, useEffect } from "react";
import { Loader2Icon, LoaderIcon, Search } from "lucide-react";
import { showError } from "../../utils/notification";
import BookDetailsModal from "../../components/BookDetailsModal";
import useItems from "../../store/useItemsStore";

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

const getItemCapacity = (itemType) => {
    return String(itemType || "").toLowerCase() === "thesis" ? 1 : 3;
};

const resolveItemAvailability = (item) => {
    const fallbackTotal = getItemCapacity(item.item_type);
    const dbTotal = Number(item.total_copies);
    const totalCopies = Number.isInteger(dbTotal) && dbTotal > 0 ? dbTotal : fallbackTotal;

    const dbAvailable = Number(item.available_copies);
    const availableCopies = Number.isInteger(dbAvailable)
        ? Math.min(Math.max(dbAvailable, 0), totalCopies)
        : (item.is_available ? totalCopies : 0);

    return {
        availableCopies,
        totalCopies,
    };
};

const getDisplayAvailability = (item) => {
    const { availableCopies, totalCopies } = resolveItemAvailability(item);
    const isThesis = String(item.item_type || "").toLowerCase() === "thesis";
    const displayAvailable = isThesis ? Math.min(availableCopies, 1) : availableCopies;
    const displayTotal = isThesis ? 1 : totalCopies;
    return `${displayAvailable}/${displayTotal}`;
};

const INITIAL_FORM = {
    itemType: "book", // "book" | "thesis"
    title: "",
    author: "",
    description: "",
    keywords: "", // comma-separated string
    itemNumber: "",
    copies: "3",
};

const BookManagement = () => {
    const { books, fetchBooks, createItem, deleteItem, isLoading } = useItems();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null); // "book" | "thesis" | null
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [form, setForm] = useState(INITIAL_FORM);
    const [selectedBook, setSelectedBook] = useState(null);
    const [bookToDelete, setBookToDelete] = useState(null);

    useEffect(() => {
        fetchBooks();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredBooks = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        const byCategory =
            selectedCategory === null
                ? books
                : books.filter((book) => String(book.item_type || "").toLowerCase() === selectedCategory);

        if (!query) return byCategory;

        return byCategory.filter((book) => {
            const searchTerms = [
                book.title,
                book.author,
                book.description,
                book.item_type,
                book.category,
                ...normalizeKeywordTokens(book.keywords),
            ];

            return searchTerms
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [books, searchQuery, selectedCategory]);

    const regularBooks = useMemo(() => {
        const regular = filteredBooks.filter((book) => String(book.item_type || "").toLowerCase() !== "thesis");
        return regular.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }, [filteredBooks]);

    const thesisBooks = useMemo(() => {
        const thesis = filteredBooks.filter((book) => String(book.item_type || "").toLowerCase() === "thesis");
        return thesis.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }, [filteredBooks]);

    const handleCategoryToggle = (category) => {
        setSelectedCategory((current) => (current === category ? null : category));
    };

    useEffect(() => {
        if (!selectedBook && !isAddModalOpen && !bookToDelete) return undefined;

        const handleKeyDown = (event) => {
            if (event.key !== "Escape") return;

            setSelectedBook(null);
            setIsAddModalOpen(false);
            setBookToDelete(null);
            setForm(INITIAL_FORM);
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [bookToDelete, isAddModalOpen, selectedBook]);

    const handleDelete = (book) => setBookToDelete(book);

    const handleConfirmDelete = async () => {
        if (!bookToDelete?.id || isLoading) return;

        try {
            await deleteItem(bookToDelete.id);

            // close modal after deleting
            setBookToDelete(null);
            // If your store doesn't update `items` on delete, keep this:
        } catch (err) {
            showError(err?.message || "Failed to delete item.");
        }
    };

    const handleAddSubmit = async () => {
        if (!form.title.trim()) return showError("Title is required.");
        if (!form.author.trim()) return showError("Author is required.");

        const parsedCopies = Number.parseInt(form.copies, 10);
        const copies = form.itemType === "thesis" ? 1 : Math.max(Number.isFinite(parsedCopies) ? parsedCopies : 0, 1);
        if (form.itemType !== "thesis" && (!Number.isInteger(copies) || copies < 1)) {
            return showError("Copies must be at least 1.");
        }

        const keywordsArray = String(form.keywords || "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

        const payload = {
            itemType: form.itemType,
            title: form.title.trim(),
            author: form.author.trim(),
            description: form.description?.trim() || "",
            keywords: keywordsArray,
            itemNumber: form.itemNumber?.trim() || "",
            copies,
        };

        try {
            await createItem(payload);
            
            setIsAddModalOpen(false);
            setForm(INITIAL_FORM);
            await fetchBooks();
        } catch (err) {
            showError(err?.message || "Failed to create item.");
        }
    };

    return (
        <section className="staff-book-management-page">
            <div className="page-header">
                <div>
                    <h2>Book Management</h2>
                    <p className="muted">Manage catalog books/theses, add new items, and remove entries.</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: "1rem" }}>
                <div className="search-input-wrapper">
                    <Search className="search-input-icon" size={18} aria-hidden="true" />
                    <input
                        className="input search-input"
                        type="search"
                        placeholder="Search by title/author/type/keywords"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </div>

                <div className="book-category-filter" role="group" aria-label="Item type filter">
                    <div className="book-category-filter__tabs">
                        <button
                            type="button"
                            aria-pressed={selectedCategory === "book"}
                            className={`btn btn--ghost${
selectedCategory === "book" ? " book-category-filter__btn--active" : ""
}`}
                            onClick={() => handleCategoryToggle("book")}
                        >
                            {selectedCategory === "book" ? "✓ Books" : "Books"}
                        </button>

                        <button
                            type="button"
                            aria-pressed={selectedCategory === "thesis"}
                            className={`btn btn--ghost${
selectedCategory === "thesis" ? " book-category-filter__btn--active" : ""
}`}
                            onClick={() => handleCategoryToggle("thesis")}
                        >
                            {selectedCategory === "thesis" ? "✓ Thesis" : "Thesis"}
                        </button>
                    </div>

                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => {
                            setForm(INITIAL_FORM);
                            setIsAddModalOpen(true);
                        }}
                    >
                        Add
                    </button>

                </div>
            </div>

            {isLoading ? (
                <div className="card" style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                    <Loader2Icon className="size-6 animate-spin" aria-label="Loading books" />
                </div>
            ) : filteredBooks.length === 0 ? (
                    <div className="empty-state">No items found.</div>
                ) : (
                    <>
                        {selectedCategory === null || selectedCategory === "book" ? (
                            <>
                                <div className="page-header page-header--thesis-scroller">
                                    <div>
                                        <h2>General Book Collection</h2>
                                    </div>
                                </div>
                                <div className="book-grid">
                                    {regularBooks.map((book) => {
                                    const keywordTokens = normalizeKeywordTokens(book.keywords);
                                    const { availableCopies } = resolveItemAvailability(book);
                                    const isAvailable = availableCopies > 0;
                                    const displayAvailability = getDisplayAvailability(book);
                                    const keywordsLine = keywordTokens.join(", ");
                                    const displayCategory = String(book.item_type || book.category || "").trim().toLowerCase() || "n/a";

                                    return (
                                    <article className="card book-card" key={book.id}>
                                        <div className="book-card__content">
                                            <div className="book-card__header">
                                                <h3 title={book.title} className="book-card__title-row">
                                                    <strong className="book-card__label">Title:</strong> <span>{book.title}</span>
                                                </h3>
                                                <div className="book-card__header-actions">
                                                    <span
                                                        className={`book-card__stock-badge ${isAvailable ? "book-card__stock-badge--ok" : "book-card__stock-badge--busy"}`}
                                                    >
                                                        {displayAvailability}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="book-card__field book-card__author">
                                                <strong className="book-card__label">Author:</strong> <span>{book.author || "N/A"}</span>
                                            </p>

                                            <p className="book-card__field book-card__keywords-line" title={keywordsLine || "N/A"}>
                                                <strong className="book-card__label">Keywords:</strong> <span>{keywordsLine || "N/A"}</span>
                                            </p>

                                            <p className="book-card__field book-card__category-line">{displayCategory}</p>

                                            <p className="book-card__field book-card__desc">
                                                <strong className="book-card__label">Description:</strong> <span>{book.description || "N/A"}</span>
                                            </p>
                                        </div>

                                        <div className="book-card__actions">
                                            <button className="btn btn--info" onClick={() => setSelectedBook(book)} disabled={isLoading}>
                                                Details
                                            </button>
                                            <button
                                                className="btn btn--danger"
                                                onClick={() => handleDelete(book)}
                                                aria-label={`Delete ${book.title}`}
                                                disabled={isLoading}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                );
                                    })}
                                </div>
                            </>
                        ) : null}

                        {(selectedCategory === null || selectedCategory === "thesis") && thesisBooks.length > 0 ? (
                            <>
                                {selectedCategory === null && regularBooks.length > 0 ? (
                                    <div className="book-section-separator" aria-hidden="true" />
                                ) : null}
                                <div className="page-header page-header--thesis-scroller">
                                    <div>
                                        <h2>Thesis Collection</h2>
                                    </div>
                                </div>
                                <div className="book-grid book-grid--thesis-scroller">
                                    {thesisBooks.map((book) => {
                                        const keywordTokens = normalizeKeywordTokens(book.keywords);
                                        const { availableCopies } = resolveItemAvailability(book);
                                        const isAvailable = availableCopies > 0;
                                        const displayAvailability = getDisplayAvailability(book);
                                        const keywordsLine = keywordTokens.join(", ");
                                        const displayCategory = String(book.item_type || book.category || "").trim().toLowerCase() || "n/a";

                                        return (
                                            <article className="card book-card" key={book.id}>
                                                <div className="book-card__content">
                                                    <div className="book-card__header">
                                                        <h3 title={book.title} className="book-card__title-row">
                                                            <strong className="book-card__label">Title:</strong> <span>{book.title}</span>
                                                        </h3>
                                                        <div className="book-card__header-actions">
                                                            <span
                                                                className={`book-card__stock-badge ${isAvailable ? "book-card__stock-badge--ok" : "book-card__stock-badge--busy"}`}
                                                            >
                                                                {displayAvailability}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p className="book-card__field book-card__author">
                                                        <strong className="book-card__label">Author:</strong> <span>{book.author || "N/A"}</span>
                                                    </p>

                                                    <p className="book-card__field book-card__keywords-line" title={keywordsLine || "N/A"}>
                                                        <strong className="book-card__label">Keywords:</strong> <span>{keywordsLine || "N/A"}</span>
                                                    </p>

                                                    <p className="book-card__field book-card__category-line">{displayCategory}</p>

                                                    <p className="book-card__field book-card__desc">
                                                        <strong className="book-card__label">Description:</strong> <span>{book.description || "N/A"}</span>
                                                    </p>
                                                </div>

                                                <div className="book-card__actions">
                                                    <button className="btn btn--info" onClick={() => setSelectedBook(book)} disabled={isLoading}>
                                                        Details
                                                    </button>
                                                    <button
                                                        className="btn btn--danger"
                                                        onClick={() => handleDelete(book)}
                                                        aria-label={`Delete ${book.title}`}
                                                        disabled={isLoading}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </>
                        ) : null}
                    </>
                    )}

            <BookDetailsModal isOpen={Boolean(selectedBook)} book={selectedBook} onClose={() => setSelectedBook(null)} />

            {bookToDelete ? (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-book-title">
                    <div className="card modal-card">
                        <h3 id="delete-book-title">Delete Item</h3>
                        <p className="muted">
                            Are you sure you want to delete <strong>{bookToDelete.title}</strong>?
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn--ghost" onClick={() => setBookToDelete(null)} disabled={isLoading}>
                                No
                            </button>
                            <button className="btn btn--danger" onClick={handleConfirmDelete} disabled={isLoading}>
                                {isLoading ? (
                                    <LoaderIcon className="size-5 flex justify-center items-center animate-spin" />
                                ) : (
                                        "Yes, Delete"
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isAddModalOpen ? (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-book-title">
                    <div className="card modal-card modal-card--book-management">
                        <h3 id="add-book-title">Add Item</h3>

                        <label className="label">Type</label>
                        <select
                            className="select"
                            value={form.itemType}
                            onChange={(event) => {
                                const nextType = event.target.value;
                                setForm((current) => ({
                                    ...current,
                                    itemType: nextType,
                                    copies: nextType === "thesis" ? "1" : (current.copies === "1" ? "3" : current.copies),
                                }));
                            }}
                            disabled={isLoading}
                        >
                            <option value="book">Book</option>
                            <option value="thesis">Thesis</option>
                        </select>

                        <label className="label">Title</label>
                        <input
                            className="input"
                            value={form.title}
                            onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
                            disabled={isLoading}
                        />

                        <label className="label">Author</label>
                        <input
                            className="input"
                            value={form.author}
                            onChange={(event) => setForm((c) => ({ ...c, author: event.target.value }))}
                            disabled={isLoading}
                        />

                        <label className="label">Item Number (optional)</label>
                        <input
                            className="input"
                            value={form.itemNumber}
                            onChange={(event) => setForm((c) => ({ ...c, itemNumber: event.target.value }))}
                            disabled={isLoading}
                        />

                        <label className="label">Copies</label>
                        <input
                            className="input"
                            type="number"
                            min="1"
                            step="1"
                            value={form.copies}
                            onChange={(event) => setForm((c) => ({ ...c, copies: event.target.value }))}
                            disabled={isLoading || form.itemType === "thesis"}
                        />
                        <p className="micro">This sets both the total and available quantity for the new item. Thesis stays at 1 copy.</p>

                        <label className="label">Description</label>
                        <textarea
                            className="input input--area"
                            value={form.description}
                            onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
                            disabled={isLoading}
                        />

                        <label className="label">Keywords (comma-separated)</label>
                        <input
                            className="input"
                            value={form.keywords}
                            onChange={(event) => setForm((c) => ({ ...c, keywords: event.target.value }))}
                            disabled={isLoading}
                        />

                        <div className="modal-actions">
                            <button
                                className="btn btn--danger btn--cancel"
                                onClick={() => {
                                    setIsAddModalOpen(false);
                                    setForm(INITIAL_FORM);
                                }}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button className="btn btn--primary" onClick={handleAddSubmit} disabled={isLoading}>
                                {isLoading ? <LoaderIcon className="flex items-center justify-center animate-spin" /> : "Add"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default BookManagement;
