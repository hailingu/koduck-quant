import { useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'

export default function Profile() {
  const { user } = useAuthStore()
  const { showToast } = useToast()
  const [avatar, setAvatar] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState(user?.username || 'fluid_trader_88')
  const [email, setEmail] = useState('alex.rivera@quantum.io')
  const [phone, setPhone] = useState('555-012-3456')
  const [bio, setBio] = useState(
    'Quantitative analyst specialized in high-frequency liquidity pools and neutral delta vault management. Tracking the flow since 2018.',
  )
  const [hasChanges, setHasChanges] = useState(false)

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatar(event.target?.result as string)
      setHasChanges(true)
      setIsUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setAvatar(null)
    setHasChanges(true)
  }

  const handleSave = () => {
    setHasChanges(false)
    showToast('Configuration saved', 'success')
  }

  const handleCancel = () => {
    setUsername(user?.username || 'fluid_trader_88')
    setEmail('alex.rivera@quantum.io')
    setPhone('555-012-3456')
    setBio(
      'Quantitative analyst specialized in high-frequency liquidity pools and neutral delta vault management. Tracking the flow since 2018.',
    )
    setAvatar(null)
    setHasChanges(false)
  }

  if (!user) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-[#1D2026]" />
          <p className="text-[#849495]">Loading profile...</p>
        </div>
      </div>
    )
  }

  const userInitial = user.username.charAt(0).toUpperCase()

  return (
    <div className="w-full pb-12 text-[#E1E2EB]">
      <main className="mx-auto w-full max-w-7xl py-8 lg:py-10">
        <header className="mb-12">
          <h1 className="mb-2 font-headline text-4xl font-bold tracking-tighter text-[#E1E2EB] md:text-5xl">
            Profile Settings
          </h1>
          <p className="max-w-2xl text-[#849495]">
            Configure your kinetic identity and communication preferences across the Fluid ecosystem.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-4">
            <section className="rounded-lg border border-[#3A494B]/10 bg-[#1D2026]/60 p-8 backdrop-blur-[20px]">
              <div className="flex flex-col items-center">
                <div className="group relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-[#00F2FF] bg-[#1D2026] p-1">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt="Avatar"
                        className="h-full w-full rounded-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#1D2026]">
                        <span className="font-headline text-4xl font-bold text-[#00F2FF]">{userInitial}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="material-symbols-outlined text-3xl text-[#00F2FF]">add_a_photo</span>
                  </div>
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                      <span className="material-symbols-outlined animate-spin text-3xl text-[#00F2FF]">
                        progress_activity
                      </span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />

                <div className="mt-6 w-full text-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-3 w-full rounded-sm border border-[#849495]/20 py-2 font-headline text-sm font-medium text-[#E1E2EB] transition-all hover:border-[#00F2FF]/40 hover:bg-[#00F2FF]/5"
                    type="button"
                  >
                    Upload New Avatar
                  </button>
                  <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[#849495]">
                    DRAG &amp; DROP SUPPORT • MAX 2MB
                  </p>
                  <button
                    onClick={handleRemoveAvatar}
                    className="font-headline text-xs font-medium text-[#FFB3B5] hover:underline"
                    type="button"
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg bg-[#191C22] p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#849495]">Liquidity Tier</span>
                <span className="rounded-full bg-[#00F2FF]/10 px-2 py-0.5 font-mono text-[10px] uppercase text-[#00F2FF]">
                  Whale Class
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#32353C]">
                <div className="h-full w-3/4 bg-[#00F2FF]" />
              </div>
              <p className="text-xs text-[#B9CACB]">
                Identity verification status: <span className="text-[#74F5FF]">Verified</span>
              </p>
            </section>
          </div>

          <div className="space-y-8 lg:col-span-8">
            <section className="rounded-lg border border-[#3A494B]/10 bg-[#1D2026]/60 p-8 backdrop-blur-[20px]">
              <h2 className="mb-8 border-b border-[#3A494B]/20 pb-4 font-headline text-xl font-bold text-[#E1E2EB]">
                Personal Information
              </h2>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-[#849495]">
                    Username <span className="text-[#DE0541]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full rounded-sm border-none bg-[#0B0E14] px-4 py-3 font-mono text-[#E1E2EB] transition-all focus:ring-1 focus:ring-[#00F2FF]"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#00F2FF]">
                      check_circle
                    </span>
                  </div>
                  <p className="text-[10px] italic text-[#6B7280]">Unique identifier within the ledger.</p>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-[#849495]">Email Address</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setHasChanges(true)
                        }}
                        className="w-full rounded-sm border-none bg-[#0B0E14] px-4 py-3 font-mono text-[#E1E2EB] opacity-80 transition-all focus:ring-1 focus:ring-[#00F2FF]"
                      />
                    </div>
                    <span className="rounded-sm border border-[#00F2FF]/20 bg-[#00F2FF]/10 px-2 py-1 font-mono text-[10px] uppercase text-[#00F2FF]">
                      Bound
                    </span>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-[#849495]">Phone Number</label>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <div className="flex min-w-[100px] items-center gap-2 rounded-sm bg-[#0B0E14] px-4 py-3">
                      <span className="material-symbols-outlined text-sm">flag</span>
                      <span className="font-mono text-sm">+1</span>
                      <span className="material-symbols-outlined text-xs">expand_more</span>
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          setHasChanges(true)
                        }}
                        className="w-full rounded-sm border-none bg-[#0B0E14] px-4 py-3 font-mono text-[#E1E2EB] transition-all focus:ring-1 focus:ring-[#00F2FF]"
                      />
                    </div>
                    <span className="rounded-sm border border-[#3A494B]/10 bg-[#1D2026] px-2 py-1 font-mono text-[10px] uppercase text-[#849495]">
                      Unbound
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#3A494B]/10 bg-[#1D2026]/60 p-8 backdrop-blur-[20px]">
              <h2 className="mb-8 border-b border-[#3A494B]/20 pb-4 font-headline text-xl font-bold text-[#E1E2EB]">
                Biographic Profile
              </h2>
              <div className="space-y-2">
                <label className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-[#849495]">
                  Bio <span className="font-normal text-[#6B7280]">{bio.length} / 200</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value.slice(0, 200))
                    setHasChanges(true)
                  }}
                  rows={4}
                  placeholder="Enter your financial bio..."
                  className="w-full resize-none rounded-sm border-none bg-[#0B0E14] p-4 text-[#E1E2EB] transition-all focus:ring-1 focus:ring-[#00F2FF]"
                />
                <p className="text-[10px] leading-relaxed text-[#6B7280]">
                  This text will be visible to other operators in terminal views.
                </p>
              </div>
            </section>

            <div className="flex flex-col items-center justify-end gap-4 pt-8 sm:flex-row">
              <button
                onClick={handleCancel}
                disabled={!hasChanges}
                className="w-full px-8 py-3 font-headline font-semibold text-[#849495] transition-colors hover:text-[#E1E2EB] disabled:opacity-50 sm:w-auto"
                type="button"
              >
                Cancel Changes
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="group relative w-full overflow-hidden rounded-sm bg-gradient-to-r from-[#00F2FF] to-[#00DBE7] py-3 font-headline font-bold uppercase tracking-widest text-[#00363A] transition-transform active:scale-[0.98] disabled:opacity-50 sm:w-64"
                type="button"
              >
                <span className="relative z-10">Save Configuration</span>
                <div className="absolute inset-0 translate-x-[-100%] bg-white/20 transition-transform duration-700 group-hover:translate-x-[100%]" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
