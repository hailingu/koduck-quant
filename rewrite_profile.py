import re

file_path = '/Users/guhailin/Git/koduck-quant/koduck-frontend/src/pages/Profile/index.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert APPLE_ARD_CLASS after imports
if 'APPLE_CARD_CLASS' not in content:
    apple_class_def = "\nconst APPLE_CARD_CLASS = 'bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5'\n"
    content = re.sub(r'(import .*?\n\n)', r'\1' + apple_class_def + '\n', content, count=1)

# 2. Replace outer card styles
content = re.sub(
    r'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700',
    r'${APPLE_CARD_CLASS}',
    content
)

# 3. Replace inner block styles
content = content.replace('bg-gray-50 dark:bg-gray-700/50 rounded-lg', 'bg-[#f5f5f7] dark:bg-white/5 rounded-[16px]')
content = content.replace('bg-gray-50 dark:bg-gray-700/50', 'bg-[#f5f5f7] dark:bg-white/5')

# 4. Text colors for titlesimport re

file_path = '/Users/gugr
file_paark
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert AP co    content = f.read()

# 1. Insert APPLE_CARD_C, 
# 1. Insert APPLE_CAtexif 'APPLE_CARD_CLASS' not in content:
   ex    apple_class_def = "\nconst APPLEt-    content = re.sub(r'(import .*?\n\n)', r'\1' + apple_class_def + '\n', content, count=1)

# 2. Replace outer card styles
content = re.sub(
    r'bg-white dark:bg-gray-800 rou
# 2. Replace outer card styles
content = re.sub(
    r'bg-white dark:bg-gray-800 rounded-l mcontent = re.sub(
    r'bg-whe(    r'bg-white d-6    r'${APPLE_CARD_CLASS}',
    content
)

# 3. Replace inner block styles
content = content.replns    content
)

# 3. Replacel)

# 3. Ree
concontent = content.replace('bg-macontent = content.replace('bg-gray-50 dark:bg-gray-700/50', 'bg-[#f5f5f7] dark:bg-white/5')

# 4. Text colors for ti t
# 4. Text colors for titlesimport re

file_path = '/Users/gugr
file_paark
with open(file_rk:
file_path = '/Users/gugr
file_paar50 file_paark
with open(fi

with openr     content = f.read()

# 1. Insert AP co    conve
# 1. Insert AP co   ver
# 1. Insert APPLE_CARD_C, 
# 1. Inser:ho# 1. Insert APPLE_CAtexifva   ex    apple_class_def = "\nconst APPLEt-    content = rear
# 2. Replace outer card styles
content = re.sub(
    r'bg-white dark:bg-gray-800 rou
# 2. Replace outer card styles
content = re.sube-5content = re.sub(
    r'bg-whnt    r'bg-white dce# 2. Replace outer card styles
conrycontent = re.sub(
    r'bg-whxt    r'bg-white dh     r'bg-whe(    r'bg-white d-6    r'${APPLE_CARD_CLASS}',
nt    content
)

# 3. Replace inner block styles
content = of)

