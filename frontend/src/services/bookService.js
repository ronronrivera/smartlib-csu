import { axiosInstance } from "../store/axios";
import { getData, saveData } from "./localStorageService";
import { getIsoTimestamp } from "../utils/dateUtils";

const BOOKS_KEY = "library_books";
const LOGS_KEY = "library_activity_logs";
const HISTORY_KEY = "library_borrow_history";
const REQUESTS_KEY = "library_borrow_requests";

// Get all books
export const getBooks = () => {
  return getData(BOOKS_KEY, []);
};

// Get book by ID
export const getBookById = (bookId) => {
  const books = getBooks();
  return books.find((b) => String(b.id) === String(bookId)) || null;
};

// Add a new book
export const addBook = (book) => {
  const books = getBooks();
  const newBook = { ...book, id: Date.now().toString() };
  books.push(newBook);
  saveData(BOOKS_KEY, books);
  return newBook;
};

// Delete a book
export const deleteBook = (bookId) => {
  const books = getBooks();
  const filtered = books.filter((b) => b.id !== bookId);
  saveData(BOOKS_KEY, filtered);
};

// Get borrow history
export const getBorrowHistory = () => {
  return getData(HISTORY_KEY, []);
};

// Get activity logs
export const getActivityLogs = () => {
  return getData(LOGS_KEY, []);
};

// Get borrow requests by borrower
export const getBorrowRequestsByBorrower = (email) => {
  const requests = getData(REQUESTS_KEY, []);
  return requests.filter(
    (req) => String(req.borrowerEmail || "").toLowerCase() === String(email || "").toLowerCase()
  );
};

// Get all borrow requests
export const getBorrowRequests = () => {
  return getData(REQUESTS_KEY, []);
};

// Receive borrow request
export const receiveBorrowRequest = (requestId) => {
  try {
    const requests = getBorrowRequests();
    const request = requests.find((r) => r.id === requestId);
    if (!request) return { ok: false, error: "Request not found" };

    request.status = "approved";
    saveData(REQUESTS_KEY, requests);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

// Receive return request
export const receiveReturnRequest = (requestId) => {
  try {
    const requests = getBorrowRequests();
    const request = requests.find((r) => r.id === requestId);
    if (!request) return { ok: false, error: "Request not found" };

    request.status = "returned";
    saveData(REQUESTS_KEY, requests);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

// Borrow a book
export const borrowBook = (bookId, borrowerEmail) => {
  try {
    const books = getBooks();
    const book = books.find((b) => String(b.id) === String(bookId));
    if (!book) return { ok: false, error: "Book not found" };

    if (!book.available) {
      return { ok: false, error: "Book is not available" };
    }

    // Create borrow request
    const requests = getBorrowRequests();
    const newRequest = {
      id: Date.now().toString(),
      bookId: bookId,
      bookTitle: book.title,
      borrowerEmail: borrowerEmail,
      action: "BORROW_BOOK",
      status: "pending",
      timestamp: new Date().toISOString()
    };
    requests.push(newRequest);
    saveData(REQUESTS_KEY, requests);

    // Add to history
    const history = getBorrowHistory();
    history.push(newRequest);
    saveData(HISTORY_KEY, history);

    return { ok: true, requestId: newRequest.id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

// Request book return
export const requestBookReturn = (bookId, borrowerEmail) => {
  try {
    const requests = getBorrowRequests();
    const newRequest = {
      id: Date.now().toString(),
      bookId: bookId,
      borrowerEmail: borrowerEmail,
      action: "RETURN_BOOK",
      status: "pending_return",
      timestamp: new Date().toISOString()
    };
    requests.push(newRequest);
    saveData(REQUESTS_KEY, requests);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

// Cancel borrow request
export const cancelBorrowRequest = (requestId) => {
  try {
    const requests = getBorrowRequests();
    const request = requests.find((r) => r.id === requestId);
    if (!request) return { ok: false, error: "Request not found" };

    request.status = "cancelled";
    saveData(REQUESTS_KEY, requests);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};
