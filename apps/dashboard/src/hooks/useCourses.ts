import { useEffect, useState } from 'react'
import { normalizeCourse, type Course } from '@/lib/courses'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface UseCoursesResult {
  courses: Course[]
  loading: boolean
  error: string | null
  configured: boolean
}

export function useCourses(): UseCoursesResult {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase no configurado')
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: queryError } = await supabase!
        .from('courses')
        .select('*')
        .eq('active', true)

      if (cancelled) return

      if (queryError) {
        setError(queryError.message)
        setCourses([])
      } else {
        setCourses((data ?? []).map((row) => normalizeCourse(row)))
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    courses,
    loading,
    error,
    configured: isSupabaseConfigured,
  }
}
