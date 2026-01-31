'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
  onFilterClick?: () => void;
  showFilter?: boolean;
  className?: string;

  // ✅ 추가: 우측 액션 버튼(즐겨찾기/알림 등)
  rightActions?: ReactNode;
}

export function Header({
  title,
  showSearch = false,
  onSearch,
  onClearSearch,
  onFilterClick,
  showFilter = false,
  className,
  rightActions,
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch?.('');
    setSearchOpen(false);
    onClearSearch?.();
  };

  return (
    <header className={cn('page-header', className)}>
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* 제목 또는 검색창 */}
          {searchOpen ? (
            <div className="flex-1 search-bar">
              <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="지역, 레벨, 강의명 검색..."
                className="search-input"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-neutral-400"
                  aria-label="검색어 지우기"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ) : (
            <h1 className="flex-1 text-lg font-bold text-neutral-900">
              {title || '해피니언 아카데미'}
            </h1>
          )}

          {/* ✅ 오른쪽 액션(즐겨찾기/알림 등) */}
          {!searchOpen && rightActions && (
  <div className="flex items-center gap-1">{rightActions}</div>
)}

          {/* 검색 버튼 */}
          {showSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className={cn(
                'p-2 rounded-xl transition-colors duration-200',
                searchOpen
                  ? 'bg-neutral-100 text-primary-500'
                  : 'text-neutral-600 hover:bg-neutral-100'
              )}
              aria-label={searchOpen ? '검색 닫기' : '검색 열기'}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
          )}

          {/* 필터 버튼 */}
          {showFilter && onFilterClick && (
            <button
              type="button"
              onClick={onFilterClick}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="필터"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}