import React, { useState } from 'react';
import ImageCropper from './components/ImageCropper';

export const ProfileEdit: React.FC = () => {
  const [avatar, setAvatar] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  
  const handleAvatarUpload = (file: File) => {
    // Avatar upload logic
  };
  
  const handleSave = async () => {
    // Save profile logic
  };
  
  return (
    <div className="profile-edit">
      <h2>个人资料</h2>
      <ImageCropper onUpload={handleAvatarUpload} />
      <input 
        value={nickname} 
        onChange={(e) => setNickname(e.target.value)}
        placeholder="昵称"
        maxLength={20}
      />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="个人简介"
        maxLength={200}
      />
      <button onClick={handleSave}>保存</button>
    </div>
  );
};
