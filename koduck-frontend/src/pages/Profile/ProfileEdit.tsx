import { useState } from 'react';
import ImageCropper from './components/ImageCropper';

export const ProfileEdit: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_avatar, _setAvatar] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  
  const handleAvatarUpload = (file: File) => {
    // Avatar upload logic
    console.log('Uploading avatar:', file.name);
  };
  
  const handleSave = async () => {
    // Save profile logic
    console.log('Saving profile:', { nickname, bio });
  };
  
  return (
    <div className="profile-edit p-6">
      <h2 className="text-2xl font-bold mb-6">个人资料</h2>
      <div className="mb-6">
        <ImageCropper onUpload={handleAvatarUpload} />
      </div>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">昵称</label>
          <input 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)}
            placeholder="昵称"
            maxLength={20}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">个人简介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="个人简介"
            maxLength={200}
            rows={4}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
};

export default ProfileEdit;
