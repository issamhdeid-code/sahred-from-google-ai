import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Package,
  Check,
  X,
  FileText,
  Barcode,
  ScanBarcode,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { Product, PurchaseItem, PurchaseInvoice } from '../../types/pharmacy';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

export const PurchaseView: React.FC = () => {
  const { purchases, suppliers, products, recordPurchase, updatePurchase, deletePurchase, exchangeRate, formatLBP, formatUSD } = usePharmacy();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseInvoice | null>(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);

  // New Purchase Items
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState('');
  const [itemQty, setItemQty] = useState('10');
  const [itemCostUSD, setItemCostUSD] = useState('');
  const [itemBatch, setItemBatch] = useState('');
  const [itemExpiry, setItemExpiry] = useState('');
  const [displayExpiry, setDisplayExpiry] = useState('');
  const [itemUnit, setItemUnit] = useState<'box' | 'piece'>('box');

  // Medication Search & Barcode Scanner State
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [scanStatusMessage, setScanStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unitInputRef = useRef<HTMLSelectElement | null>(null);
  const expiryInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const costInputRef = useRef<HTMLInputElement | null>(null);

  const selectedProduct = products.find((p) => p.id === currentProductId);

  // Global Barcode Scanner Listener when New Purchase modal is open
  useBarcodeScanner({
    onScan: (scanned) => {
      if (!isCreateOpen) return;
      const clean = scanned.trim();
      if (!clean) return;

      const found = products.find(
        (p) =>
          (p.barcode || '').toLowerCase() === clean.toLowerCase() ||
          p.code.toLowerCase() === clean.toLowerCase()
      );

      if (found) {
        selectProduct(found, true);
        setScanStatusMessage({
          type: 'success',
          text: `Scanned: ${found.name} (${found.barcode || found.code})`,
        });
        setTimeout(() => setScanStatusMessage(null), 3500);
      } else {
        setScanStatusMessage({
          type: 'error',
          text: `Barcode "${clean}" not found in inventory. You can search by name or code.`,
        });
        setTimeout(() => setScanStatusMessage(null), 4000);
      }
    },
  });

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to find the expiry date and batch number from the most recent purchase for a given product
  const getLastPurchaseDetails = (prod: Product): { expiryDate: string, batchNumber: string } => {
    let expiryDate = '';
    let batchNumber = '';
    
    if (!purchases || purchases.length === 0) return { expiryDate, batchNumber };

    // Sort purchases by timestamp or date descending (newest first)
    const sorted = [...purchases].sort((a, b) => {
      const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
      return timeB - timeA;
    });

    for (const p of sorted) {
      if (!p.items || p.items.length === 0) continue;
      const foundItem = p.items.find(
        (it) =>
          (it.productId && it.productId === prod.id) ||
          (it.productCode && prod.code && it.productCode.toLowerCase() === prod.code.toLowerCase())
      );
      if (foundItem) {
        if (!expiryDate && foundItem.expiryDate && foundItem.expiryDate.trim()) {
          expiryDate = foundItem.expiryDate.trim();
        }
        if (!batchNumber && foundItem.batchNumber && foundItem.batchNumber.trim()) {
          batchNumber = foundItem.batchNumber.trim();
        }
        
        // If we found both, we can break early
        if (expiryDate && batchNumber) break;
      }
    }

    return { expiryDate, batchNumber };
  };

  // Helper to format stock in "X box Y pieces" format using product's pieceName
  const formatStockBoxesAndPieces = (prod: Product): string => {
    const isDivisible = Boolean(prod.isDivisible && prod.piecesPerBox && prod.piecesPerBox > 1);

    if (!isDivisible) {
      const qty = Number.isInteger(prod.stockQuantity) ? prod.stockQuantity : prod.stockQuantity.toFixed(2);
      return `${qty} box`;
    }

    const piecesPerBox = prod.piecesPerBox || 1;
    const totalPieces = Math.round((prod.stockQuantity || 0) * piecesPerBox);
    const boxes = Math.floor(totalPieces / piecesPerBox);
    const pieces = totalPieces % piecesPerBox;

    const rawPieceName = prod.pieceName?.trim() || 'piece';
    const pieceLabel =
      pieces > 1 && !rawPieceName.toLowerCase().endsWith('s')
        ? `${rawPieceName}s`
        : rawPieceName;

    if (pieces > 0) {
      return `${boxes} box ${pieces} ${pieceLabel}`;
    }
    return `${boxes} box`;
  };

  const selectProduct = (prod: Product, autoFocusQty = true) => {
    setCurrentProductId(prod.id);
    setItemCostUSD(prod.costPriceUSD != null ? prod.costPriceUSD.toString() : '5.00');
    setItemUnit('box');
    setProductSearchQuery(prod.name);
    setIsSearchDropdownOpen(false);
    setScanStatusMessage(null);

    // Fetch last purchase details (batch and expiry)
    const lastDetails = getLastPurchaseDetails(prod);

    // Auto-fill batch
    if (lastDetails.batchNumber) {
      setItemBatch(lastDetails.batchNumber);
    } else if (prod.batches && prod.batches.length > 0) {
      setItemBatch(prod.batches[0].batchNumber || '');
    } else {
      setItemBatch(prod.batchNumber || '');
    }

    // Expiry date: use expiry from the last purchase for this product directly, or keep blank if not found
    const lastExpiry = lastDetails.expiryDate;

    if (lastExpiry) {
      if (lastExpiry.includes('-')) {
        const parts = lastExpiry.split('-');
        let year = parts[0].trim();
        let month = parts[1] ? parts[1].trim() : '01';
        if (year.length <= 2 && month.length === 4) {
          const tmp = year;
          year = month;
          month = tmp;
        }
        if (year.length === 2) year = `20${year}`;
        month = month.padStart(2, '0');
        setItemExpiry(`${year}-${month}-01`);
        setDisplayExpiry(`${month}/${year}`);
      } else if (lastExpiry.includes('/')) {
        const parts = lastExpiry.split('/');
        const month = parts[0].trim().padStart(2, '0');
        let year = parts[1].trim();
        if (year.length === 2) year = `20${year}`;
        setItemExpiry(`${year}-${month}-01`);
        setDisplayExpiry(`${month}/${year}`);
      } else {
        const digits = lastExpiry.replace(/\D/g, '');
        if (digits.length === 4) {
          const month = digits.slice(0, 2);
          const year = `20${digits.slice(2, 4)}`;
          setItemExpiry(`${year}-${month}-01`);
          setDisplayExpiry(`${month}/${year}`);
        } else if (digits.length === 6) {
          const month = digits.slice(0, 2);
          const year = digits.slice(2, 6);
          setItemExpiry(`${year}-${month}-01`);
          setDisplayExpiry(`${month}/${year}`);
        } else {
          setItemExpiry(lastExpiry);
          setDisplayExpiry(lastExpiry);
        }
      }
    } else {
      // If not found, keep it blank
      setItemExpiry('');
      setDisplayExpiry('');
    }

    if (autoFocusQty) {
      // Always focus the expiry input so user can review or enter the date
      setTimeout(() => {
        expiryInputRef.current?.focus();
        expiryInputRef.current?.select();
      }, 50);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    let digits = input.replace(/[^\d]/g, '');
    if (digits.length > 6) digits = digits.slice(0, 6);

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length === 2 && input.endsWith('/')) {
      formatted = `${digits}/`;
    }

    setDisplayExpiry(formatted);

    if (digits.length === 6) {
      const month = digits.slice(0, 2);
      const year = digits.slice(2, 6);
      setItemExpiry(`${year}-${month}-01`);
    } else if (digits.length === 4) {
      const month = digits.slice(0, 2);
      const year = `20${digits.slice(2, 4)}`;
      setItemExpiry(`${year}-${month}-01`);
    } else {
      setItemExpiry('');
    }
  };

  const handleExpiryBlur = () => {
    const digits = displayExpiry.replace(/[^\d]/g, '');
    if (digits.length === 4) {
      const month = digits.slice(0, 2);
      const year = `20${digits.slice(2, 4)}`;
      setDisplayExpiry(`${month}/${year}`);
    }
  };

  // Filter products by query: name, code, barcode, ingredients, or agent
  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const supplierName = supplier?.name.toLowerCase() || '';
      return [...products]
        .sort((a, b) => {
          const aMatchesSupplier =
            supplierName && (a.agent || '').toLowerCase().includes(supplierName) ? -1 : 1;
          const bMatchesSupplier =
            supplierName && (b.agent || '').toLowerCase().includes(supplierName) ? -1 : 1;
          return aMatchesSupplier - bMatchesSupplier;
        })
        .slice(0, 30);
    }

    return filterProductsByMultiWordQuery(products, q, 'all').slice(0, 50);
  }, [products, productSearchQuery, selectedSupplierId, suppliers]);

  // Auto-scroll highlighted item into view within the dropdown so it is 100% visible at all times
  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    const activeEl = itemRefs.current[highlightedIndex];
    const container = listContainerRef.current;
    if (!activeEl || !container) return;

    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;
    const activeBottom = activeTop + activeHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const containerScrollBottom = containerScrollTop + containerHeight;

    if (activeTop < containerScrollTop) {
      // Scrolled above visible viewport: align with top plus comfortable cushion
      container.scrollTo({
        top: Math.max(0, activeTop - 6),
        behavior: 'auto',
      });
    } else if (activeBottom > containerScrollBottom) {
      // Scrolled below visible viewport: align with bottom plus comfortable cushion
      container.scrollTo({
        top: activeBottom - containerHeight + 8,
        behavior: 'auto',
      });
    }
  }, [highlightedIndex, isSearchDropdownOpen]);

  // Reset highlight index to 0 when search query or supplier changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [productSearchQuery, selectedSupplierId]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(0);
      } else if (filteredProducts.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(filteredProducts.length > 0 ? filteredProducts.length - 1 : 0);
      } else if (filteredProducts.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = productSearchQuery.trim().toLowerCase();

      // 1. Exact barcode or code match takes priority if user typed or scanned
      if (q) {
        const exactMatch = products.find(
          (p) =>
            (p.barcode || '').toLowerCase() === q ||
            p.code.toLowerCase() === q
        );

        if (exactMatch) {
          selectProduct(exactMatch, true);
          setScanStatusMessage({
            type: 'success',
            text: `Found: ${exactMatch.name} (${exactMatch.barcode || exactMatch.code})`,
          });
          setTimeout(() => setScanStatusMessage(null), 3000);
          return;
        }
      }

      // 2. Select highlighted item from dropdown list
      if (filteredProducts.length > 0) {
        const safeIndex =
          highlightedIndex >= 0 && highlightedIndex < filteredProducts.length
            ? highlightedIndex
            : 0;
        const targetProduct = filteredProducts[safeIndex];
        if (targetProduct) {
          selectProduct(targetProduct, true);
          setScanStatusMessage({
            type: 'success',
            text: `Selected: ${targetProduct.name} (${targetProduct.code})`,
          });
          setTimeout(() => setScanStatusMessage(null), 2500);
          return;
        }
      }

      // 3. Fallback message if no match found
      if (q) {
        setScanStatusMessage({
          type: 'error',
          text: `No item matches "${productSearchQuery.trim()}". Try another name, code, or barcode.`,
        });
        setTimeout(() => setScanStatusMessage(null), 3500);
      }
    } else if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
    }
  };

  const handleAddItemToInvoice = () => {
    if (!selectedProduct) {
      setScanStatusMessage({
        type: 'error',
        text: 'Please select or scan an item first.',
      });
      searchInputRef.current?.focus();
      return;
    }
    const qty = parseInt(itemQty, 10) || 1;
    const costUSD = parseFloat(itemCostUSD) || selectedProduct.costPriceUSD || 5.0;
    const costLBP = Math.round(costUSD * exchangeRate);

    let finalExpiry = itemExpiry;
    if (!finalExpiry && displayExpiry.trim()) {
      const digits = displayExpiry.replace(/\D/g, '');
      if (digits.length === 4) {
        finalExpiry = `20${digits.slice(2, 4)}-${digits.slice(0, 2)}-01`;
      } else if (digits.length === 6) {
        finalExpiry = `${digits.slice(2, 6)}-${digits.slice(0, 2)}-01`;
      } else {
        finalExpiry = displayExpiry.trim();
      }
    }

    setItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productName: selectedProduct.name,
        quantity: qty,
        unitCostUSD: costUSD,
        unitCostLBP: costLBP,
        sellingPriceLBP: selectedProduct.priceLBP,
        batchNumber: itemBatch || selectedProduct.batchNumber || '',
        expiryDate: finalExpiry || '',
        isPiece: itemUnit === 'piece',
      },
    ]);

    // Reset current item inputs & search query for fast next entry
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('10');
    setItemCostUSD('');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setItemUnit('box');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalCostUSD = items.reduce((sum, item) => sum + item.unitCostUSD * item.quantity, 0);
  const totalCostLBP = Math.round(totalCostUSD * exchangeRate);

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);

    if (editingPurchaseId) {
      updatePurchase(editingPurchaseId, {
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'General Supplier',
        date: invoiceDate,
        items,
        totalCostUSD,
        totalCostLBP,
        paid: isPaid,
      });
    } else {
      recordPurchase({
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'General Supplier',
        date: invoiceDate,
        items,
        totalCostUSD,
        totalCostLBP,
        exchangeRate,
        status: 'received',
        paid: isPaid,
      });
    }

    setItems([]);
    setEditingPurchaseId(null);
    setIsCreateOpen(false);
  };

  const handleOpenCreate = () => {
    setIsCreateOpen(true);
    setEditingPurchaseId(null);
    setItems([]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setIsPaid(true);
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('10');
    setItemCostUSD('');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleEditPurchase = (inv: PurchaseInvoice) => {
    setEditingPurchaseId(inv.id);
    setSelectedSupplierId(inv.supplierId);
    setInvoiceDate(inv.date);
    setIsPaid(inv.paid);
    setItems(inv.items);
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('10');
    setItemCostUSD('');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);
    setIsCreateOpen(true);
  };

  const handleDeletePurchase = (id: string) => {
    if (confirm('Are you sure you want to delete this purchase? This will revert the stock added.')) {
      deletePurchase(id);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <SectionRestoreButton section="purchase" />
            <Truck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              Purchases & Supplier Invoices
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Restock inventory from Lebanese agents (Mersaco, Omnipharma, Fattal) & track shipment arrivals.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Purchase Invoice</span>
        </button>
      </div>

      {/* Invoices Table */}
      <div className="flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Supplier</th>
                <th className="py-2 px-3">Items Received</th>
                <th className="py-2 px-3">Total USD ($)</th>
                <th className="py-2 px-3">Total LBP</th>
                <th className="py-2 px-3">Rate Applied</th>
                <th className="py-2 px-3">Payment Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    No purchase invoices registered yet.
                  </td>
                </tr>
              ) : (
                purchases.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-slate-300">
                      {inv.date}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {inv.supplierName}
                    </td>
                    <td className="py-2 px-3">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                        {inv.items.reduce((s, i) => s + i.quantity, 0)} units ({inv.items.length} items)
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400">
                      ${inv.totalCostUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 font-medium text-green-700 dark:text-green-400">
                      {inv.totalCostLBP.toLocaleString()} LBP
                    </td>
                    <td className="py-2 px-3 text-gray-500 font-mono text-[10px]">
                      1$ = {inv.exchangeRate.toLocaleString()} LBP
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          inv.paid
                            ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {inv.paid ? 'Settled (Paid)' : 'Pending Debt'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setViewingPurchase(inv)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditPurchase(inv)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/30 rounded"
                          title="Edit Purchase"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePurchase(inv.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 rounded"
                          title="Delete Purchase"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingPurchase && (
        <DesktopWindow
          title={`Purchase Invoice Details - ${viewingPurchase.invoiceNumber}`}
          isOpen={true}
          section="purchase"
          onClose={() => setViewingPurchase(null)}
          width="600px"
          height="auto"
        >
          <div className="p-5 space-y-4 text-sm text-slate-800 dark:text-slate-200">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Supplier</span>
                <span className="font-semibold">{viewingPurchase.supplierName}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Date</span>
                <span className="font-semibold">{viewingPurchase.date}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Payment Status</span>
                <span className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  viewingPurchase.paid
                    ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {viewingPurchase.paid ? 'Paid' : 'Unpaid Debt'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Exchange Rate</span>
                <span className="font-semibold">{viewingPurchase.exchangeRate.toLocaleString()} LBP</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">Items</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {viewingPurchase.items.map((it, idx) => {
                  const productDetails = products.find(p => p.id === it.productId);
                  return (
                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                    <div>
                      <div className="font-bold">
                        {it.productName}
                        {productDetails && (
                          <span className="ml-1.5 font-normal text-slate-500 text-[11px]">
                            {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity} {it.isPiece ? 'pieces' : 'units'} • Batch: {it.batchNumber} • Exp: {it.expiryDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600 dark:text-blue-400">${(it.quantity * it.unitCostUSD).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">@ ${it.unitCostUSD.toFixed(2)} / ea</div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            <div className="flex justify-end items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-x-4">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Total USD</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">${viewingPurchase.totalCostUSD.toFixed(2)}</span>
              </div>
              <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-4">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Total LBP</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{viewingPurchase.totalCostLBP.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* New Purchase Modal */}
      {isCreateOpen && (
        <DesktopWindow
          title={editingPurchaseId ? "Edit Purchase Invoice" : "Receive Supplier Shipment (Restock Inventory)"}
          isOpen={true}
          section="purchase"
          onClose={() => setIsCreateOpen(false)}
          width="700px"
          height="auto"
        >
          <form onSubmit={handleSavePurchase} className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Supplier / Agent
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Status
                </label>
                <select
                  value={isPaid ? 'paid' : 'debt'}
                  onChange={(e) => setIsPaid(e.target.value === 'paid')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="paid">Paid (Cash / Bank)</option>
                  <option value="debt">Unpaid (Add to Supplier Debt)</option>
                </select>
              </div>
            </div>

            {/* Add Items Row */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-teal-600" />
                  Add Medication / Item to Shipment
                </span>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <ScanBarcode className="h-3.5 w-3.5 text-teal-600" />
                  <span>Scan barcode or type name/code</span>
                </div>
              </div>

              {scanStatusMessage && (
                <div
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    scanStatusMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
                  }`}
                >
                  {scanStatusMessage.type === 'success' ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{scanStatusMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                <div className="sm:col-span-2 relative" ref={searchDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Medication / Item
                    </label>
                  </div>

                  {/* Primary searchable input with live matching by Name, Drug Code, or Barcode */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-3.5 w-3.5" />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductSearchQuery(val);
                        if (val.trim().length > 0) {
                          setIsSearchDropdownOpen(true);
                          setHighlightedIndex(0);
                        } else {
                          setIsSearchDropdownOpen(false);
                        }
                      }}
                      onFocus={() => {
                        if (productSearchQuery.trim().length > 0) {
                          setIsSearchDropdownOpen(true);
                        }
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Type name, code, barcode, or scan box..."
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-16 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
                      {productSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearchQuery('');
                            setCurrentProductId('');
                            setIsSearchDropdownOpen(false);
                            searchInputRef.current?.focus();
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          title="Clear search"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchDropdownOpen((prev) => !prev);
                          searchInputRef.current?.focus();
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        title="Browse medication list"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fallback & accessible select element to maintain exact DOM structure */}
                  <select
                    value={currentProductId}
                    onChange={(e) => {
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod) {
                        selectProduct(prod, true);
                      }
                    }}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <option value="">-- Choose Medication --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) {p.barcode ? `[${p.barcode}]` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Dropdown Suggestions Menu */}
                  {isSearchDropdownOpen && (
                    <div
                      id="purchase-product-suggestions-dropdown"
                      className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white/98 dark:border-slate-700 dark:bg-slate-900/98 shadow-2xl flex flex-col overflow-hidden text-xs backdrop-blur-xs"
                    >
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">
                          <AlertCircle className="h-5 w-5 mx-auto mb-1.5 text-slate-400" />
                          <span className="font-semibold">No products match "{productSearchQuery}"</span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Try searching by code, barcode, or Lebanese supplier
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            ref={listContainerRef}
                            className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                          >
                            {filteredProducts.map((prod, index) => {
                              const isHighlighted = index === highlightedIndex;
                              const isSelected = prod.id === currentProductId;
                              return (
                                <div
                                  key={prod.id}
                                  ref={(el) => {
                                    itemRefs.current[index] = el;
                                  }}
                                  id={`purchase-product-option-${prod.id}`}
                                  role="option"
                                  aria-selected={isHighlighted}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectProduct(prod, true);
                                  }}
                                  onMouseEnter={() => setHighlightedIndex(index)}
                                  className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 select-none ${
                                    isHighlighted
                                      ? 'bg-teal-600 text-white dark:bg-teal-600 dark:text-white shadow-xs'
                                      : isSelected
                                      ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 border-l-2 border-teal-500 font-semibold'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold truncate flex items-center gap-1.5">
                                      <span className={isHighlighted ? 'text-white' : 'text-slate-900 dark:text-slate-100'}>
                                        {prod.name}
                                      </span>
                                      <span className={`text-[10px] font-normal ${isHighlighted ? 'text-teal-100' : 'text-slate-400'}`}>
                                        {prod.dosage} {prod.presentation} {prod.form}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] mt-0.5 font-mono">
                                      {prod.agent && (
                                        <span className={`font-sans text-[9px] ${isHighlighted ? 'text-teal-100' : 'text-slate-400'}`}>
                                          {prod.agent}
                                        </span>
                                      )}
                                      {prod.barcode && (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 ${
                                            isHighlighted
                                              ? 'bg-teal-700/90 text-teal-100 border border-teal-500/40'
                                              : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                                          }`}
                                        >
                                          <Barcode className="h-2.5 w-2.5" />
                                          {prod.barcode}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 flex items-center gap-2">
                                    <div>
                                      <div className={`font-bold ${isHighlighted ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                        ${(prod.costPriceUSD || 5).toFixed(2)}
                                      </div>
                                      <div className={`text-[9px] font-bold ${
                                        isHighlighted 
                                          ? 'text-white/90' 
                                          : prod.stockQuantity === 0 
                                            ? 'text-red-600 dark:text-red-400' 
                                            : prod.stockQuantity <= 3 
                                              ? 'text-amber-600 dark:text-amber-400' 
                                              : 'text-green-600 dark:text-green-400'
                                      }`}>
                                        Stock: {prod.stockQuantity}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Keyboard Navigation Footer Hint */}
                          <div className="bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-end shrink-0">
                            <span className="text-[9px] text-slate-400">
                              {filteredProducts.length} items
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit</label>
                  <select
                    ref={unitInputRef}
                    id="purchase-item-unit"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value as 'box' | 'piece')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        expiryInputRef.current?.focus();
                        expiryInputRef.current?.select();
                      }
                    }}
                    disabled={!selectedProduct?.isDivisible}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  >
                    <option value="box">Box</option>
                    {selectedProduct?.isDivisible && (
                      <option value="piece">{selectedProduct.pieceName || 'Piece'}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Expiry</label>
                  <input
                    ref={expiryInputRef}
                    id="purchase-item-expiry"
                    type="text"
                    value={displayExpiry}
                    onChange={handleExpiryChange}
                    onFocus={(e) => e.target.select()}
                    onBlur={handleExpiryBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExpiryBlur();
                        qtyInputRef.current?.focus();
                        qtyInputRef.current?.select();
                      }
                    }}
                    placeholder="MM/YY"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Quantity</label>
                  <input
                    ref={qtyInputRef}
                    id="purchase-item-qty"
                    type="number"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        costInputRef.current?.focus();
                        costInputRef.current?.select();
                      }
                    }}
                    placeholder="10"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit Cost USD ($)</label>
                  <input
                    ref={costInputRef}
                    id="purchase-item-cost"
                    type="number"
                    step="0.01"
                    value={itemCostUSD}
                    onChange={(e) => setItemCostUSD(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItemToInvoice();
                      }
                    }}
                    placeholder="5.00"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddItemToInvoice}
                    className="w-full rounded-lg bg-teal-600 py-1.5 text-xs font-bold text-white hover:bg-teal-700 transition-colors shadow-sm cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              {/* Selected Product Info & Lot Details */}
              {selectedProduct && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedProduct.name}
                    </span>
                    {(selectedProduct.dosage || selectedProduct.presentation || selectedProduct.form) && (
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        {[selectedProduct.dosage, selectedProduct.presentation, selectedProduct.form]
                          .map((s) => s?.trim())
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                    )}
                    {selectedProduct.barcode && (
                      <span className="font-mono text-[10px] bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Barcode className="h-3 w-3" />
                        {selectedProduct.barcode}
                      </span>
                    )}
                    <span id="purchase-item-stock-qty" className="text-slate-500">
                      In Stock: <strong className="text-slate-700 dark:text-slate-200">{formatStockBoxesAndPieces(selectedProduct)}</strong>
                    </span>
                    {selectedProduct.agent && (
                      <span className="text-slate-500">
                        Agent: <strong className="text-slate-700 dark:text-slate-200">{selectedProduct.agent}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">Batch #:</label>
                      <input
                        id="purchase-item-batch"
                        type="text"
                        value={itemBatch}
                        onChange={(e) => setItemBatch(e.target.value)}
                        placeholder="BT-9900"
                        className="w-24 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Items List in New Purchase */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/40 shadow-sm">
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="mb-2 flex justify-center">
                    <FileText className="h-8 w-8 opacity-20" />
                  </div>
                  No items added to invoice yet.
                </div>
              ) : (
                items.map((it, idx) => {
                  const productDetails = products.find(p => p.id === it.productId);
                  return (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {it.productName}
                        {productDetails && (
                          <span className="ml-1.5 font-normal text-slate-500 text-[11px]">
                            {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                          </span>
                        )}
                        {it.isPiece && (
                          <span className="ml-1.5 inline-block rounded-sm bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                            PIECE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {it.quantity} {it.isPiece ? 'pieces' : 'units'} @ ${it.unitCostUSD.toFixed(2)} — <span className="text-teal-600 dark:text-teal-400 font-bold">${(it.quantity * it.unitCostUSD).toFixed(2)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )})
              )}
            </div>

            {/* Total Summary */}
            {items.length > 0 && (
              <div className="flex justify-between items-center rounded-xl bg-teal-50 border border-teal-100 p-3.5 text-teal-950 font-bold dark:bg-teal-950/40 dark:text-teal-300 shadow-sm">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Invoice Grand Total:
                </span>
                <div className="text-right">
                  <div className="text-sm font-extrabold">${totalCostUSD.toFixed(2)}</div>
                  <div className="text-[10px] opacity-75">{totalCostLBP.toLocaleString()} LBP</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Discard Invoice
              </button>
              <button
                type="submit"
                disabled={items.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{editingPurchaseId ? 'Save Changes' : 'Receive & Restock Items'}</span>
              </button>
            </div>
          </form>
        </DesktopWindow>
      )}
    </div>
  );
};
