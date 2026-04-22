import React, { useState, useRef, useEffect, useCallback } from 'react';
import './MentionInput.scss';

/**
 * Textarea con soporte de @menciones.
 * Props:
 *  - value: string (texto actual)
 *  - onChange: fn(newValue) → actualiza texto en el padre
 *  - onMentionedUsersChange: fn(ids[]) → IDs de usuarios mencionados
 *  - members: [{id, username, first_name, last_name, profile_picture}]
 *  - placeholder, rows, disabled
 */
const MentionInput = ({
  value = '',
  onChange,
  onMentionedUsersChange,
  members = [],
  placeholder = 'Escribe un comentario... usa @ para mencionar a alguien',
  rows = 3,
  disabled = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(null); // cursor position where @ was typed
  const [mentionedIds, setMentionedIds] = useState(new Set());

  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter members by query
  const filtered = members.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.username?.toLowerCase().includes(q) ||
      m.first_name?.toLowerCase().includes(q) ||
      m.last_name?.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const handleKeyDown = useCallback((e) => {
    if (!showDropdown) return;
    if (e.key === 'Escape') {
      setShowDropdown(false);
      e.preventDefault();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = dropdownRef.current?.querySelectorAll('.mention-item');
      if (!items?.length) return;
      const focused = dropdownRef.current.querySelector('.mention-item.focused');
      let idx = Array.from(items).indexOf(focused);
      if (e.key === 'ArrowDown') idx = (idx + 1) % items.length;
      else idx = (idx - 1 + items.length) % items.length;
      items.forEach((el) => el.classList.remove('focused'));
      items[idx]?.classList.add('focused');
      items[idx]?.scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      const focused = dropdownRef.current?.querySelector('.mention-item.focused');
      if (focused) {
        e.preventDefault();
        focused.click();
      }
    }
  }, [showDropdown]);

  const handleChange = (e) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;

    // Detect @ trigger: find if cursor is right after an @ that starts a word
    const textBefore = text.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);

    if (match) {
      setMentionStart(cursor - match[0].length);
      setQuery(match[1]);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
      setMentionStart(null);
    }

    onChange(text);
  };

  const selectMember = (member) => {
    const textarea = textareaRef.current;
    const cursor = textarea.selectionStart;

    // Replace the @query fragment with @username + space
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const insertion = `@${member.username} `;
    const newValue = before + insertion + after;

    onChange(newValue);

    // Track mentioned user
    const newIds = new Set(mentionedIds);
    newIds.add(member.id);
    setMentionedIds(newIds);
    onMentionedUsersChange?.([...newIds]);

    setShowDropdown(false);
    setQuery('');

    // Move cursor after inserted text
    requestAnimationFrame(() => {
      const pos = (before + insertion).length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        !textareaRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Reset mentioned IDs when value is cleared externally
  useEffect(() => {
    if (!value) {
      setMentionedIds(new Set());
      onMentionedUsersChange?.([]);
    }
  }, [value]);

  return (
    <div className="mention-input-wrapper">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="mention-textarea"
      />

      {showDropdown && filtered.length > 0 && (
        <div className="mention-dropdown" ref={dropdownRef}>
          {filtered.map((member, i) => (
            <div
              key={member.id}
              className={`mention-item${i === 0 ? ' focused' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMember(member);
              }}
            >
              <div className="mention-avatar">
                {member.profile_picture ? (
                  <img src={member.profile_picture} alt={member.first_name} />
                ) : (
                  <span>{(member.first_name || member.username || '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="mention-info">
                <span className="mention-name">
                  {member.first_name} {member.last_name}
                </span>
                <span className="mention-username">@{member.username}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
