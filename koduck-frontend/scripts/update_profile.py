import os

file_path = '/Users/guhailin/Git/koduck-quant/koduck-frontend/src/pages/Profile/index.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all card containers
content = content.replace('bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700', '${APPLE_CARD_CLASS}')
content = content.replace('bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700', '${APPLE_CARD_CLASS}')

# Backgrounds
content = content.replace('bg-gray-50 dark:bg-gray-700/50 rounded-lg', 'bg-[#f5f5f7] dark:bg-white/5 rounded-[16px]')
content = content.replace('bg-gray-50 dark:bg-gray-700/50', 'bg-[#f5f5f7] dark:bg-white/5')
content = content.replace('bg-gray-50 dark:bg-gray-800', 'bg-[#f5f5f7] dark:bg-[#1d1d1f]')
content = content.replace('bg-gray-100 dark:bg-gray-800', 'bg-[#e5e5ea] dark:bg-white/10')
content = content.replace('hover:bg-gray-100 dark:hover:bg-gray-700', 'hover:bg-gray-200 dark:hover:bg-white/10')
content = content.replace('hover:bg-gray-50 dark:hover:bg-gray-800', 'hover:bg-[#f5f5f7] dark:hover:bg-white/5')
content = content.replace('bg-primary-100 dark:bg-primary-900/30', 'bg-blue-50 dark:bg-blue-500/10')
content = content.replace('bg-primary-50 dark:bg-primary-900/20', 'bg-blue-50 dark:bg-blue-500/10')
content = content.replace('bg-primary-50 text-primary-600', 'bg-blue-50 text-[#007AFF]')

# Text colors
content = content.replace('text-gray-900 dark:text-white', 'text-[#1d1d1f] dark:text-white')
content = content.replace('text-gray-900', 'text-[#1d1d1f]')
content = content.replace('text-gray-600 dark:text-gray-400', 'text-[#86868b] dark:text-gray-400')
content = content.replace('text-gray-600', 'text-[#86868b]')
content = content.replace('text-gray-700 dark:text-gray-300', 'text-[#1d1d1f] dark:text-gray-300')
content = content.replace('text-gray-500 dark:text-gray-400', 'text-[#86868b] dark:text-gray-400')
content = content.replace('text-gray-500 dark:text-gray-500', 'text-[#86868b] dark:text-gray-500')
content = content.replace('text-gray-500', 'text-[#86868b]')
content = content.replace('text-primary-600 dark:text-primary-400', 'text-[#007AFF] dark:text-[#0a84ff]')
content = content.replace('text-primary-600', 'text-[#007AFF]')
content = content.replace('text-primary-700 dark:text-primary-300', 'text-blue-600 dark:text-blue-300')

# Borders / Divides
content = content.replace('divide-y divide-gray-200 dark:divide-gray-700', 'divide-y divide-gray-100 dark:divide-gray-800')
content = content.replace('border-b border-gray-200 dark:border-gray-700', 'border-b border-gray-100 dark:border-gray-800')
content = content.replace('border border-gray-200 dark:border-gray-700', 'border border-gray-100 dark:border-gray-800')

# Buttons
content = content.replace('bg-primary-600 hover:bg-primary-700 text-white', 'bg-[#007AFF] hover:bg-[#005bb5] text-white rounded-full')
content = content.replace('border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700', 'border border-gray-200 dark:border-gray-700 shadow-sm text-sm font-medium text-[#1d1d1f] dark:text-gray-200 bg-white dark:bg-[#1d1d1f] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full')

content = content.replace('tabular-nums', '') 
content = content.replace('font-semibold', 'font-semibold tracking-tight')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done update_profile.py')
