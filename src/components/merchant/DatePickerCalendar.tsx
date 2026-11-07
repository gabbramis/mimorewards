"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface DatePickerCalendarProps {
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  businessCreatedAt?: string | null;
  stampsCountByDate: Record<string, number>;
  isActive?: boolean;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function formatButtonLabel(dateStr: string | null): string {
  if (!dateStr) return "Elegir día";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const dayNum = d.getDate();
    const monthShort = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
    return `${dayNum} ${monthShort} ${year}`;
  } catch {
    return dateStr;
  }
}

export default function DatePickerCalendar({
  selectedDate,
  onSelectDate,
  onClear,
  businessCreatedAt,
  stampsCountByDate,
  isActive = false,
}: DatePickerCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const initialYear = selectedDate
    ? parseInt(selectedDate.split("-")[0], 10)
    : now.getFullYear();
  const initialMonth = selectedDate
    ? parseInt(selectedDate.split("-")[1], 10) - 1
    : now.getMonth();

  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth);

  useEffect(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const limits = useMemo(() => {
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    let creationDayStart = 0;
    let creationYearMonth = 0;
    if (businessCreatedAt) {
      const bDate = new Date(businessCreatedAt);
      if (!isNaN(bDate.getTime())) {
        creationDayStart = new Date(
          bDate.getFullYear(),
          bDate.getMonth(),
          bDate.getDate()
        ).getTime();
        creationYearMonth = bDate.getFullYear() * 12 + bDate.getMonth();
      }
    }

    const currentYearMonth = now.getFullYear() * 12 + now.getMonth();

    return {
      todayStart,
      creationDayStart,
      creationYearMonth,
      currentYearMonth,
    };
  }, [now, businessCreatedAt]);

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const blanks = Array.from({ length: offset }, (_, i) => ({
      key: `blank-${i}`,
      isBlank: true,
      day: 0,
      dateKey: "",
      disabled: true,
      isInactive: false,
      isSelected: false,
      isToday: false,
      stampsCount: 0,
    }));

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const thisDayStart = new Date(viewYear, viewMonth, day).getTime();

      const isBeforeCreation =
        limits.creationDayStart > 0 && thisDayStart < limits.creationDayStart;
      const isFuture = thisDayStart > limits.todayStart;
      const disabled = isBeforeCreation || isFuture;

      const isInHistory = !isBeforeCreation && !isFuture;
      const stampsCount = stampsCountByDate[dateKey] || 0;
      const isInactive = isInHistory && stampsCount === 0;

      const isSelected = selectedDate === dateKey;
      const isToday = thisDayStart === limits.todayStart;

      return {
        key: dateKey,
        isBlank: false,
        day,
        dateKey,
        disabled,
        isInactive,
        isSelected,
        isToday,
        stampsCount,
      };
    });

    return [...blanks, ...days];
  }, [viewYear, viewMonth, limits, stampsCountByDate, selectedDate]);

  const viewYearMonth = viewYear * 12 + viewMonth;
  const canGoPrev =
    limits.creationYearMonth === 0 || viewYearMonth > limits.creationYearMonth;
  const canGoNext = viewYearMonth < limits.currentYearMonth;

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dateKey: string) => {
    onSelectDate(dateKey);
    setIsOpen(false);
  };

  const handleTodayClick = () => {
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
    onSelectDate(todayKey);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear();
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div className="inline-flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
            isActive && selectedDate
              ? "bg-white text-black font-semibold"
              : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
          }`}
          title="Abrir selector de fecha calendario"
        >
          <CalendarIcon size={12} className={isActive && selectedDate ? "text-black" : "text-zinc-400"} />
          <span>{formatButtonLabel(selectedDate)}</span>
          {isActive && selectedDate && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearClick}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 text-black/80 hover:text-black transition-colors"
              title="Borrar selección"
            >
              <X size={11} />
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:translate-y-0 sm:w-80 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="text-xs font-semibold text-white tracking-wide capitalize">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canGoNext}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider"
              >
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((cell) => {
              if (cell.isBlank) {
                return <div key={cell.key} className="h-8 w-8 sm:h-9 sm:w-9" />;
              }

              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => handleSelectDay(cell.dateKey)}
                  title={
                    cell.disabled
                      ? "Fecha fuera del historial activo"
                      : cell.isInactive
                      ? `${cell.day} de ${MONTH_NAMES[viewMonth]} (0 sellos registrados)`
                      : `${cell.day} de ${MONTH_NAMES[viewMonth]} (${cell.stampsCount} sellos)`
                  }
                  className={`group relative flex h-8 w-8 sm:h-9 sm:w-9 flex-col items-center justify-center rounded-xl text-xs font-medium transition-all mx-auto cursor-pointer ${
                    cell.disabled
                      ? "text-zinc-600 cursor-not-allowed opacity-35 pointer-events-none"
                      : cell.isSelected
                      ? "bg-white text-black font-semibold"
                      : cell.isToday
                      ? "border border-white text-white font-semibold hover:bg-zinc-800"
                      : "text-zinc-200 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <span className="leading-none">{cell.day}</span>

                  {cell.isInactive && (
                    <span
                      className={`absolute bottom-1 h-1.5 w-1.5 rounded-full transition-transform ${
                        cell.isSelected ? "bg-black" : "bg-amber-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-[10px] font-medium leading-none">
                0 sellos (inactivo)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTodayClick}
                className="rounded-lg px-2 py-1 text-[10px] font-semibold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hoy
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={handleClearClick}
                  className="rounded-lg px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
