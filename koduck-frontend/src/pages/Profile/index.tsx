import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { Check, Upload } from 'lucide-react'

// Mock user data
interface UserProfile {
  id: string
  username: string
  email: string
  phone?: string
  phoneCountry?: string
  bio: string
  avatar?: string
  tier: 'whale' | 'dolphin' | 'fish'
  verificationStatus: 'verified' | 'pending' | 'unverified'
}

const mockUser: UserProfile = {
  id: '1',
  username: 'fluid_trader_88',
  email: 'alex.rivera@quantum.io',
  phone: '555-012-3456',
  phoneCountry: '+1',
  bio: 'Quantitative analyst specialized in high-frequency liquidity pools and neutral delta vault management. Tracking the flow since 2018.',
  tier: 'whale',
  verificationStatus: 'verified',
}

const countryCodes = [
  { code: '+1', flag: '🇺🇸', name: 'US' },
  { code: '+86', flag: '🇨🇳', name: 'CN' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+81', flag: '🇯🇵', name: 'JP' },
]

export default function Profile() {
  const [user, setUser] = useState<UserProfile>(mockUser)
  const [formData, setFormData] = useState(mockUser)
  const [isDirty, setIsDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  // Check if form has changes
  useEffect(() => {
    const hasChanges = 
      formData.username !== user.username ||
      formData.email !== user.email ||
      formData.phone !== user.phone ||
      formData.bio !== user.bio
    setIsDirty(hasChanges)
  }, [formData, user])

  const handleSave = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800))
    setUser(formData)
    setIsDirty(false)
    setIsLoading(false)
    showToast('Configuration saved successfully', 'success')
  }

  const handleCancel = () => {
    setFormData(user)
    setIsDirty(false)
  }

  const handleAvatarUpload = () => {
    showToast('Avatar upload feature coming soon', 'info')
  }

  const handleRemoveAvatar = () => {
    setFormData({ ...formData, avatar: undefined })
    setIsDirty(true)
  }

  const tierProgress = {
    whale: 85,
    dolphin: 60,
    fish: 30,
  }

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-headline font-bold text-fluid-text mb-3">
          Profile Settings
        </h1>
        <p className="text-fluid-text-muted max-w-2xl">
          Configure your kinetic identity and communication preferences across the Fluid ecosystem.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Avatar & Tier */}
        <div className="col-span-4 space-y-6">
          {/* Avatar Card */}
          <div className="glass-panel rounded-xl p-6">
            {/* Avatar Image */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-lg border-2 border-fluid-primary overflow-hidden bg-fluid-surface-container">
                  {formData.avatar ? (
                    <img 
                      src={formData.avatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fluid-primary/20 to-fluid-primary/5">
                      <span className="text-4xl font-bold text-fluid-primary">
                        {formData.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleAvatarUpload}
              className="w-full py-3 border border-fluid-outline-variant rounded-lg text-fluid-text font-medium hover:border-fluid-primary hover:text-fluid-primary transition-colors mb-3"
            >
              <span className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                Upload New Avatar
              </span>
            </button>

            <p className="text-center text-xs text-fluid-text-muted mb-4">
              DRAG & DROP SUPPORT • MAX 2MB
            </p>

            {/* Remove Link */}
            <button
              onClick={handleRemoveAvatar}
              className="w-full text-center text-sm text-fluid-secondary hover:text-fluid-secondary/80 transition-colors"
            >
              Remove Image
            </button>
          </div>

          {/* Liquidity Tier Card */}
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">
                Liquidity Tier
              </span>
              <span className="px-2 py-1 bg-fluid-primary/20 text-fluid-primary text-xs font-bold rounded">
                WHALE CLASS
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-fluid-surface-container rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-fluid-primary rounded-full"
                style={{ width: `${tierProgress[formData.tier]}%` }}
              />
            </div>

            <p className="text-sm text-fluid-text-muted">
              Identity verification status:{' '}
              <span className="text-fluid-primary">
                {formData.verificationStatus === 'verified' ? 'Verified' : formData.verificationStatus}
              </span>
            </p>
          </div>
        </div>

        {/* Right Column - Forms */}
        <div className="col-span-8 space-y-6">
          {/* Personal Information */}
          <div className="glass-panel rounded-xl p-6">
            <h2 className="text-xl font-headline font-bold text-fluid-text mb-6">
              Personal Information
            </h2>

            <div className="space-y-6">
              {/* Username & Email Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Username */}
                <div>
                  <label className="block text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-fluid-surface-container border border-fluid-outline-variant rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary transition-colors"
                    />
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fluid-primary" />
                  </div>
                  <p className="mt-2 text-xs text-fluid-text-muted italic">
                    Unique identifier within the ledger.
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flex-1 px-4 py-3 bg-fluid-surface-container border border-fluid-outline-variant rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary transition-colors"
                    />
                    <span className="px-3 py-3 bg-fluid-primary/20 text-fluid-primary text-xs font-bold rounded border border-fluid-primary/30">
                      BOUND
                    </span>
                  </div>
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.phoneCountry}
                    onChange={(e) => setFormData({ ...formData, phoneCountry: e.target.value })}
                    className="px-4 py-3 bg-fluid-surface-container border border-fluid-outline-variant rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary transition-colors appearance-none cursor-pointer"
                  >
                    {countryCodes.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="555-012-3456"
                    className="flex-1 px-4 py-3 bg-fluid-surface-container border border-fluid-outline-variant rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary transition-colors"
                  />
                  <span className="px-3 py-3 bg-fluid-secondary/20 text-fluid-secondary text-xs font-bold rounded border border-fluid-secondary/30">
                    UNBOUND
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Biographic Profile */}
          <div className="glass-panel rounded-xl p-6">
            <h2 className="text-xl font-headline font-bold text-fluid-text mb-6">
              Biographic Profile
            </h2>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono-data text-fluid-text-muted uppercase tracking-wider">
                  Bio
                </label>
                <span className="text-xs text-fluid-text-muted">
                  {formData.bio.length} / 200
                </span>
              </div>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 200) })}
                rows={5}
                className="w-full px-4 py-3 bg-fluid-surface-container border border-fluid-outline-variant rounded-lg text-fluid-text focus:outline-none focus:border-fluid-primary transition-colors resize-none"
              />
              <p className="mt-2 text-xs text-fluid-text-muted">
                This text will be visible to other operators in terminal views.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-8 right-8 flex items-center gap-4">
        <button
          onClick={handleCancel}
          disabled={!isDirty || isLoading}
          className="px-6 py-3 text-fluid-text font-medium hover:text-fluid-text-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel Changes
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || isLoading}
          className="px-8 py-3 bg-fluid-primary text-fluid-surface-container-lowest font-bold tracking-wider hover:bg-fluid-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-fluid-surface-container-lowest border-t-transparent rounded-full animate-spin" />
              SAVING...
            </>
          ) : (
            'SAVE CONFIGURATION'
          )}
        </button>
      </div>
    </div>
  )
}
