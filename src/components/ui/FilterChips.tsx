'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REGIONS, LEVELS } from '@/lib/constants';

export type FilterChipsProps = {
  regions?: string[];
  levels?: string[];

  selectedRegion: string | null;
  selectedLevel: string | null;

  onRegionChange: (region: string | null) => void;
  onLevelChange: (level: string | null) => void;

  showAllOption?: boolean;
  className?: string;
};

export function FilterChips({
  regions,
  levels,
  selectedRegion,
  selectedLevel,
  onRegionChange,
  onLevelChange,
  showAllOption = true,
  className,
}: FilterChipsProps) {
  const regionOptions = regions ?? REGIONS;
  const levelOptions = levels ?? LEVELS;

  return (
    <div className={cn('space-y-3', className)}>
      {/* 지역 필터 */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 pb-1">
          {showAllOption && (
            <button
              type="button"
              onClick={() => onRegionChange(null)}
              className={cn(
                'filter-chip whitespace-nowrap',
                !selectedRegion && 'filter-chip-active'
              )}
            >
              전체 지역
            </button>
          )}

          {regionOptions.map((region) => (
            <button
              key={region}
              type="button"
              onClick={() => onRegionChange(selectedRegion === region ? null : region)}
              className={cn(
                'filter-chip whitespace-nowrap',
                selectedRegion === region && 'filter-chip-active'
              )}
            >
              {region}
              {selectedRegion === region && <X className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* 레벨 필터 */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 pb-1">
          {showAllOption && (
            <button
              type="button"
              onClick={() => onLevelChange(null)}
              className={cn(
                'filter-chip whitespace-nowrap',
                !selectedLevel && 'filter-chip-active'
              )}
            >
              전체 레벨
            </button>
          )}

          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onLevelChange(selectedLevel === level ? null : level)}
              className={cn(
                'filter-chip whitespace-nowrap',
                selectedLevel === level && 'filter-chip-active'
              )}
            >
              {level}
              {selectedLevel === level && <X className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 간단한 필터 칩 (한 줄)
export type SimpleFilterChipsProps = {
  options: string[];
  selected: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
  className?: string;
};

export function SimpleFilterChips({
  options,
  selected,
  onChange,
  allLabel = '전체',
  className,
}: SimpleFilterChipsProps) {
  return (
    <div className={cn('overflow-x-auto scrollbar-hide -mx-4 px-4', className)}>
      <div className="flex gap-2 pb-1">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn('filter-chip whitespace-nowrap', !selected && 'filter-chip-active')}
        >
          {allLabel}
        </button>

        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(selected === option ? null : option)}
            className={cn('filter-chip whitespace-nowrap', selected === option && 'filter-chip-active')}
          >
            {option}
            {selected === option && <X className="w-3.5 h-3.5" />}
          </button>
        ))}
      </div>
    </div>
  );
}