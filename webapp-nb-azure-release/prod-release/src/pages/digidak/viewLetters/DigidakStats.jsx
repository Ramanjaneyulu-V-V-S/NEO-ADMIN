import React from "react";

const StatCard = ({ title, data, handleCardClick }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-100 mb-1">
      <div className="digidak-stats-header mb-1 pb-2">
        <h6 className="digidak-stats-title m-0 fw-bold clr-333 text-white">{title}</h6>
      </div>
      <div className="row g-2">
        {data?.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index} className="col-12 col-md-4">
              <div className={`card-bg cursor-pointer ${item.cardClass}`} onClick={() => handleCardClick(item)}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="card-count">{item.value}</span>
                    <p className="count-card-name mb-0">{item.label}</p>
                  </div>
                  {Icon && <Icon className={`card-icon ${item.iconClass}`} style={{ width: 28, height: 28 }} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DigidakStats = ({ receivedData, issuedData, handleCardClick }) => {
  return (
    <div className="row g-4 mb-3">
      <div className="col-12 col-xl-6">
        <StatCard title="Received" data={receivedData} handleCardClick={handleCardClick} />
      </div>
      <div className="col-12 col-xl-6">
        <StatCard title="Issued" data={issuedData} handleCardClick={handleCardClick} />
      </div>
    </div>
  );
};

export default DigidakStats;
