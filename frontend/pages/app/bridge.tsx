import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, UserProfile } from '../../lib/supabase'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { Clock, Layers } from 'lucide-react'
import Link from 'next/link'

export default function BridgePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [router])

  return (
    <DashboardLayout profile={profile} title="Revenue Bridge">
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card p-12 text-center mt-10">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
            <Clock size={28} className="text-brand-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-700 mb-4">
            Coming Soon
          </div>
          <h2 className="font-display text-2xl font-800 text-ink-900 mb-3">Revenue Bridge</h2>
          <p className="text-ink-500 text-sm leading-relaxed max-w-md mx-auto mb-8">
            New Logo, Upsell, Downsell, Churn with 1M/3M/12M lookback windows and PE-grade waterfall table. Currently in development.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/app/cohort" className="btn-primary text-sm">
              <Layers size={14} /> Try Cohort Analytics
            </Link>
            <Link href="/dashboard" className="btn-secondary text-sm">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
