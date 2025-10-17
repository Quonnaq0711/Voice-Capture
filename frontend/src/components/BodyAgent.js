import React from 'react';

const BodyAgent = () => {
  return (
    <div className="w-full h-screen bg-gray-50 overflow-auto">
      {/* Display the Body Agent design as a static image */}
      <img
        src="/design/Body Agent.png"
        alt="Body Agent Interface"
        className="w-full h-auto"
        style={{ minHeight: '100vh', objectFit: 'contain' }}
      />
    </div>
  );
};

export default BodyAgent;
