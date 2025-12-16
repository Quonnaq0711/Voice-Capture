import React from 'react';

const TravelAgent = () => {
  return (
    <div className="w-full h-screen bg-gray-50 overflow-auto">
      {/* Display the Travel Agent 4.0 design as a static image */}
      <img
        src="/design/Travel Agent 4.0.png"
        alt="Travel Agent Interface"
        className="w-full h-auto"
        style={{ minHeight: '100vh', objectFit: 'contain' }}
      />
    </div>
  );
};

export default TravelAgent;
