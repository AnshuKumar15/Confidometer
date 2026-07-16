"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";

// Scrollable column component mimicking iOS/Android alarm wheel
function ScrollColumn({ items, value, onChange }) {
  const containerRef = useRef(null);
  const [localActive, setLocalActive] = useState(value);
  const isScrolling = useRef(false);
  const timeoutRef = useRef(null);

  const ITEM_HEIGHT = 40;

  // Sync state if value changes from outside (and we are not scrolling)
  useEffect(() => {
    if (!isScrolling.current && containerRef.current) {
      const index = items.indexOf(value);
      if (index !== -1) {
        const currentScrollIndex = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
        if (currentScrollIndex !== index) {
          containerRef.current.scrollTop = index * ITEM_HEIGHT;
        }
      }
    }
    setLocalActive(value);
  }, [value, items]);

  const handleScroll = (e) => {
    isScrolling.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const scrollTop = e.target.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const activeItem = items[index];

    if (activeItem !== undefined && activeItem !== localActive) {
      setLocalActive(activeItem);
    }

    timeoutRef.current = setTimeout(() => {
      isScrolling.current = false;
      if (activeItem !== undefined && activeItem !== value) {
        onChange(activeItem);
      }
    }, 100);
  };

  const handleItemClick = (index) => {
    isScrolling.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setLocalActive(items[index]);
    
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: "smooth"
      });
    }

    timeoutRef.current = setTimeout(() => {
      isScrolling.current = false;
      onChange(items[index]);
    }, 250);
  };

  return (
    <div style={{ position: "relative", height: "200px", width: "65px", overflow: "hidden" }}>
      {/* Scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: "100%",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          display: "flex",
          flexDirection: "column"
        }}
        className="scroll-column-container"
      >
        {/* Top spacer (leaves 2 items visible space before center) */}
        <div style={{ height: "80px", flexShrink: 0 }} />

        {/* Scroll items */}
        {items.map((item, idx) => {
          const isSelected = item === localActive;
          const distance = Math.abs(items.indexOf(localActive) - idx);
          
          let opacity = 0.2;
          if (distance === 0) opacity = 1;
          else if (distance === 1) opacity = 0.5;

          return (
            <div
              key={idx}
              onClick={() => handleItemClick(idx)}
              style={{
                height: `${ITEM_HEIGHT}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isSelected ? "1.25rem" : "1.05rem",
                fontWeight: isSelected ? "700" : "500",
                color: isSelected ? "var(--teal)" : "var(--text)",
                opacity: opacity,
                cursor: "pointer",
                scrollSnapAlign: "center",
                transition: "opacity 0.15s, font-size 0.15s, color 0.15s",
                flexShrink: 0,
                userSelect: "none"
              }}
            >
              {item}
            </div>
          );
        })}

        {/* Bottom spacer */}
        <div style={{ height: "80px", flexShrink: 0 }} />
      </div>
    </div>
  );
}

export default function DateTimePicker({ value, onChange, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial value (expected format: YYYY-MM-DDTHH:MM)
  const getInitialDate = () => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    // Default to today plus 1 hour, rounded to next 30 min
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(d.getMinutes() > 30 ? 0 : 30);
    return d;
  };

  const initialDate = getInitialDate();

  // Internal states
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  // Determine hours (1-12), minutes (0-59), and AM/PM strings
  const getHourStr = (dateObj) => {
    const hrs = dateObj.getHours();
    let val = hrs;
    if (hrs === 0) val = 12;
    else if (hrs > 12) val = hrs - 12;
    return String(val).padStart(2, "0");
  };

  const getMinStr = (dateObj) => {
    return String(dateObj.getMinutes()).padStart(2, "0");
  };

  const getAmPmStr = (dateObj) => {
    return dateObj.getHours() >= 12 ? "PM" : "AM";
  };

  const [selectedHour, setSelectedHour] = useState(getHourStr(initialDate));
  const [selectedMinute, setSelectedMinute] = useState(getMinStr(initialDate));
  const [selectedAmpm, setSelectedAmpm] = useState(getAmPmStr(initialDate));

  // Lists for scroll columns
  const hoursList = Array.from({ length: 12 }).map((_, i) => String(i + 1).padStart(2, "0"));
  const minutesList = Array.from({ length: 60 }).map((_, i) => String(i).padStart(2, "0"));

  // Sync state if value changes from parent
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setSelectedHour(getHourStr(parsed));
        setSelectedMinute(getMinStr(parsed));
        setSelectedAmpm(getAmPmStr(parsed));
      }
    }
  }, [value]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update parent when any parameter changes
  const updateParentValue = (dateObj, hourStr, minuteStr, ampmStr) => {
    let hrs24 = parseInt(hourStr, 10);
    if (ampmStr === "PM" && hrs24 < 12) {
      hrs24 += 12;
    } else if (ampmStr === "AM" && hrs24 === 12) {
      hrs24 = 0;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const hh = String(hrs24).padStart(2, "0");
    const mm = String(minuteStr).padStart(2, "0");

    // Format: YYYY-MM-DDTHH:MM
    const isoString = `${year}-${month}-${day}T${hh}:${mm}`;
    onChange(isoString);
  };

  // Selection actions
  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    updateParentValue(newDate, selectedHour, selectedMinute, selectedAmpm);
  };

  const handleHourChange = (newHour) => {
    setSelectedHour(newHour);
    updateParentValue(selectedDate, newHour, selectedMinute, selectedAmpm);
  };

  const handleMinuteChange = (newMinute) => {
    setSelectedMinute(newMinute);
    updateParentValue(selectedDate, selectedHour, newMinute, selectedAmpm);
  };

  const handleAmpmChange = (newAmpm) => {
    setSelectedAmpm(newAmpm);
    updateParentValue(selectedDate, selectedHour, selectedMinute, newAmpm);
  };

  // Calendar Helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Format current state for displaying in the trigger button
  const formatDisplay = () => {
    const options = { month: "short", day: "numeric", year: "numeric" };
    const datePart = selectedDate.toLocaleDateString(undefined, options);
    return `${datePart} - ${selectedHour}:${selectedMinute} ${selectedAmpm}`;
  };

  // Check if date is in the past
  const isPastDate = (d) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(year, month, d);
    return target < today;
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Scrollbar-hide styles injected globally */}
      <style dangerouslySetInnerHTML={{__html: `
        .scroll-column-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scroll-column-container::-webkit-scrollbar {
          display: none !important;
        }
      `}} />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "8px",
          background: "rgba(0,0,0,0.3)",
          border: "1px solid var(--line)",
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "1.05rem",
          transition: "border-color 0.2s, box-shadow 0.2s"
        }}
        className="datetime-picker-trigger"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <CalendarIcon size={16} style={{ color: "var(--teal)" }} />
          <span>{value ? formatDisplay() : "Select Date & Time..."}</span>
        </div>
        <Clock size={16} style={{ color: "var(--muted)", opacity: 0.7 }} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="glass"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 100,
            display: "flex",
            flexDirection: "row",
            background: "var(--surface-strong)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            backdropFilter: "blur(20px)",
            gap: "24px",
            width: "580px",
            maxWidth: "calc(100vw - 32px)",
            flexWrap: "wrap"
          }}
        >
          {/* Calendar Section (Left Side) */}
          <div style={{ flex: "1 1 250px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                {monthNames[month]} {year}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={prevMonth}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 6px",
                    color: "var(--text)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 6px",
                    color: "var(--text)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", textAlign: "center" }}>
              {/* Day Headers */}
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
                <div key={dayName} style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "600", paddingBottom: "4px" }}>
                  {dayName}
                </div>
              ))}

              {/* Empty padding for offset */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Days of Month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const isSelected =
                  selectedDate.getDate() === dayNum &&
                  selectedDate.getMonth() === month &&
                  selectedDate.getFullYear() === year;
                const disabled = isPastDate(dayNum);

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDateClick(dayNum)}
                    style={{
                      aspectRatio: "1",
                      background: isSelected
                        ? "linear-gradient(135deg, var(--teal), var(--cyan))"
                        : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      color: isSelected
                        ? "#02060c"
                        : disabled
                        ? "rgba(255,255,255,0.15)"
                        : "var(--text)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      fontSize: "0.85rem",
                      fontWeight: isSelected ? "700" : "400",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background-color 0.15s, color 0.15s",
                      outline: "none"
                    }}
                    className={!disabled && !isSelected ? "calendar-day-hover" : ""}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Picker Section - Phone Alarm Style Scroll Columns (Right Side) */}
          <div style={{ flex: "1 1 230px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontWeight: "700", fontSize: "0.95rem", marginBottom: "4px" }}>Time Selection</span>
            
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              padding: "10px",
              position: "relative",
              gap: "2px"
            }}>
              {/* Highlight selection frame overlay centered */}
              <div style={{
                position: "absolute",
                top: "calc(50% - 20px)",
                left: "8px",
                right: "8px",
                height: "40px",
                borderTop: "1px solid rgba(45, 212, 191, 0.25)",
                borderBottom: "1px solid rgba(45, 212, 191, 0.25)",
                background: "rgba(45, 212, 191, 0.04)",
                pointerEvents: "none",
                borderRadius: "4px"
              }} />

              {/* Hour Wheel */}
              <ScrollColumn
                items={hoursList}
                value={selectedHour}
                onChange={handleHourChange}
              />
              
              {/* Colon Separator */}
              <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--muted)", userSelect: "none", paddingBottom: "2px" }}>:</span>
              
              {/* Minute Wheel */}
              <ScrollColumn
                items={minutesList}
                value={selectedMinute}
                onChange={handleMinuteChange}
              />

              {/* Space */}
              <div style={{ width: "8px" }} />

              {/* AM/PM Wheel */}
              <ScrollColumn
                items={["AM", "PM"]}
                value={selectedAmpm}
                onChange={handleAmpmChange}
              />
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                width: "100%",
                padding: "10px 0",
                background: "linear-gradient(135deg, var(--teal), var(--cyan))",
                border: "none",
                borderRadius: "6px",
                color: "#02060c",
                fontWeight: "700",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                marginTop: "6px"
              }}
            >
              <Check size={14} />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* Global CSS Inject for Day hover highlights */}
      <style jsx global>{`
        .calendar-day-hover:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: var(--teal) !important;
        }
        .datetime-picker-trigger:hover {
          border-color: var(--teal) !important;
          box-shadow: 0 0 10px rgba(45, 212, 191, 0.15) !important;
        }
      `}</style>
    </div>
  );
}
