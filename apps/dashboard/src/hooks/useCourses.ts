import { useCallback, useEffect, useState } from 'react'
import { normalizeCourse, type Course } from '@/lib/courses'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface UseCoursesResult {
  courses: Course[]
  loading: boolean
  error: string | null
  configured: boolean
  refresh: () => Promise<void>
}

export function useCourses(): UseCoursesResult {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase no configurado')
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('courses')
      .select('*')
      .eq('active', true)

    if (queryError) {
      setError(queryError.message)
      setCourses([])
    } else {
      setCourses((data ?? []).map((row) => normalizeCourse(row)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    courses,
    loading,
    error,
    configured: isSupabaseConfigured,
    refresh,
  }
}
