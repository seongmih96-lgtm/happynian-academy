'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Eye, EyeOff, UserPlus, Loader2, ChevronDown } from 'lucide-react';
import { REGIONS, LEVELS } from '@/lib/constants';

export default function SignupPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
    region: '',
    level: '',
    referrer: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (formData.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return false;
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    if (!formData.name.trim()) {
      setError('이름을 입력해주세요.');
      return false;
    }
    if (!formData.region) {
      setError('지역을 선택해주세요.');
      return false;
    }
    if (!formData.level) {
      setError('레벨을 선택해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setError('');
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
            region: formData.region,
            level: formData.level,
            referrer: formData.referrer,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('이미 가입된 이메일입니다.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-secondary-50 to-white">
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary-100 flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">회원가입 완료!</h1>
          <p className="text-neutral-500 text-center mb-8 max-w-xs">
            {formData.referrer.includes('해피니언') 
              ? '자동 승인되었습니다. 바로 로그인하세요!'
              : '관리자 승인 후 서비스를 이용하실 수 있습니다.'}
          </p>
          <Link href="/login" className="btn-primary px-8">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50 to-white">
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto w-full max-w-sm">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900">회원가입</h1>
            <p className="mt-2 text-neutral-500">해피니언 아카데미에 오신 것을 환영합니다</p>
          </div>

          {/* 회원가입 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="label">이메일 *</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
                placeholder="email@example.com"
                required
                autoComplete="email"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="label">비밀번호 *</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="input pr-12"
                  placeholder="6자 이상"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="passwordConfirm" className="label">비밀번호 확인 *</label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={handleChange}
                className="input"
                placeholder="비밀번호를 다시 입력하세요"
                required
                autoComplete="new-password"
              />
            </div>

            {/* 이름 */}
            <div>
              <label htmlFor="name" className="label">이름 *</label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="홍길동"
                required
                autoComplete="name"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label htmlFor="phone" className="label">연락처</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="input"
                placeholder="010-1234-5678"
                autoComplete="tel"
              />
            </div>

            {/* 지역 선택 */}
            <div>
              <label htmlFor="region" className="label">지역 *</label>
              <div className="relative">
                <select
                  id="region"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="input appearance-none cursor-pointer"
                  required
                >
                  <option value="">지역을 선택하세요</option>
                  {REGIONS.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* 레벨 선택 */}
            <div>
              <label htmlFor="level" className="label">레벨 *</label>
              <div className="relative">
                <select
                  id="level"
                  name="level"
                  value={formData.level}
                  onChange={handleChange}
                  className="input appearance-none cursor-pointer"
                  required
                >
                  <option value="">레벨을 선택하세요</option>
                  {LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* 추천인 */}
            <div>
              <label htmlFor="referrer" className="label">
                추천인 / 가입경로
                <span className="ml-2 text-xs text-neutral-400 font-normal"></span>
              </label>
              <input
                id="referrer"
                name="referrer"
                type="text"
                value={formData.referrer}
                onChange={handleChange}
                className="input"
                placeholder="예: 해피니언 홍길동, 네이버 검색 등"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  회원가입
                </>
              )}
            </button>
          </form>

          {/* 로그인 링크 */}
          <p className="mt-6 text-center text-sm text-neutral-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
