import { useState } from "react";
import { useNavigate } from "react-router-dom";

const imgRim1 =
  "https://www.figma.com/api/mcp/asset/67d143de-8aa2-47fa-866f-40ffe553a924";
const imgEllipse2 =
  "https://www.figma.com/api/mcp/asset/30840591-4908-486a-b629-c774a2ba713b";
const imgEllipse1 =
  "https://www.figma.com/api/mcp/asset/80f92d73-4b34-47cf-883b-9fcd6cb924a5";
const imgWorkLine =
  "https://www.figma.com/api/mcp/asset/7f29d29b-411e-492a-a60a-b1c3add9d108";

function SearchBox({ className }) {
  return (
    <div
      className={className || "h-[40px] relative w-[290px]"}
      data-name="search box"
    >
      <div className="absolute bg-[rgba(255,255,255,0.05)] inset-0 rounded-[10px]" />
      <p className="absolute font--inter font-normal inset-[30%_76.9%_27.5%_6.9%] leading-normal text-[14px] text-[rgba(255,255,255,0.6)] whitespace-nowrap">
        Search
      </p>
    </div>
  );
}

function AccountProfileIcon() {
  return (
    <div
      className="absolute inset-[93.92%_6.55%_1.05%_89.64%]"
      data-name="smartie"
    >
      <div className="absolute bg-[#5768a6] inset-[37.61%_14.75%_0_14.75%] rounded-[18px]" />
      <div className="absolute bg-[#909bcd] inset-[11.93%_21.31%_41.28%_22.13%] rounded-[12px]" />
      <div className="absolute bg-[#909bcd] inset-[52.29%_0_15.6%_89.34%] rounded-[10px]" />
      <div className="absolute bg-[#909bcd] inset-[52.29%_89.34%_15.6%_0] rounded-[10px]" />
      <div className="absolute inset-[21.1%_56.56%_62.39%_28.69%]">
        <img
          alt="accent"
          className="absolute block max-w-none size-full"
          src={imgEllipse2}
        />
      </div>
      <div className="absolute inset-[21.1%_27.87%_62.39%_57.38%]">
        <img
          alt="accent"
          className="absolute block max-w-none size-full"
          src={imgEllipse2}
        />
      </div>
      <div className="absolute inset-[25.69%_60.66%_66.97%_32.79%]">
        <img
          alt="accent"
          className="absolute block max-w-none size-full"
          src={imgEllipse1}
        />
      </div>
      <div className="absolute inset-[25.69%_31.97%_66.97%_61.48%]">
        <img
          alt="accent"
          className="absolute block max-w-none size-full"
          src={imgEllipse1}
        />
      </div>
      <div className="absolute bg-[#909bcd] inset-[0_47.54%_88.07%_49.18%]" />
    </div>
  );
}

function MenuSection({
  items,
  rotationStart,
  color,
  textSize = "16px",
  tracking = "0",
  onClick,
}) {
  return items.map((item, idx) => (
    <button
      key={idx}
      onClick={() => onClick && onClick(item.route)}
      className="absolute flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
      style={{
        left: item.left,
        top: item.top,
        width: item.width,
        height: item.height,
        background: "transparent",
        border: "none",
        padding: 0,
      }}
      title={item.tooltip}
    >
      <div
        className="flex-none"
        style={{ transform: `rotate(${item.rotation}deg)` }}
      >
        <p
          className="font-semibold leading-normal relative whitespace-nowrap"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: textSize,
            color: color,
            letterSpacing: tracking === "0" ? "0" : tracking,
            fontVariationSettings: "'wdth' 100",
          }}
        >
          {item.text}
        </p>
      </div>
    </button>
  ));
}

export default function WorkPage() {
  const navigate = useNavigate();
  const [showWorkMenu, setShowWorkMenu] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  const handleMenuClick = (route) => {
    if (route) {
      navigate(route);
    }
  };

  const workMenuOptions = [
    { label: "Dashboard", icon: "📊", route: "/dashboard" },
    { label: "Settings", icon: "⚙️", route: "/settings" },
    { label: "Help", icon: "❓", route: "/help" },
  ];

  // Directory item
const directoryItems = [
  {
    text: "Directory",
    path: "M 50 170 A 155 140 0 0 1 225 44",
    route: "/agents/career",
    tooltip: "Directory",
    id: "directoryCurve",
    color: "#4190ff",
  },
];

const scheduleItems = [
  {
    text: "Schedule",
    path: "M 154 12 A 140 150 0 0 0 298 428",
    route: "/agents/hobby",
    tooltip: "Schedule",
    id: "scheduleCurve",
    color: "#ffffff",
  },
];

const connectItems = [
  {
    text: "Connections",
    path: "M 176 408 A 140 152 0 0 0 315 30",
    route: "/agents/family-life",
    tooltip: "Connections",
    id: "connectCurve",
    color: "#b67bfe",
    },
];

const toolsItems = [
  {
    text: "Tools",
    path: "M 111 147 A 130 150 0 0 1 400 320",
    route: "/agents/tools",
    tooltip: "Tools",
    id: "toolsCurve",
    color: "#fdd300",
  },
];

  const todoItems = [
    {
      text: "To Do",
      path: "M 145 425 A 200 98 0 0 0 310 420",
      route: "/dashboard",
      tooltip: "Todo",
      id: "todoCurve",
      color: "#fd6900",
  },
];

  return (
    <div
      className="bg-[#001a33] relative w-full h-screen overflow-hidden"
      data-name="work agent screen"
    >
      {/* Header Section */}
      <div
        className="absolute left-0 top-[50px] w-full h-auto"
        data-name="header"
      >
        {/* Idii Logo */}
        <p
          className="absolute font-bold text-white tracking-wider whitespace-nowrap"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "64px",
            fontWeight: 700,
            letterSpacing: "6.4px",
            top: "550px",
            left: "40px",
            fontVariationSettings: "'wdth' 100",
          }}
        >
          Idii.
        </p>

        {/* Work Title Section with Hover Menu */}
        <div
          className="absolute top-0 left-10 w-[270px]"
          onMouseEnter={() => setShowWorkMenu(true)}
          onMouseLeave={() => setShowWorkMenu(false)}
        >
          {/* Decorative Line */}
          <div className="absolute right-[35%] top-[15px] h-0.5 w-full bg-slate-400  opacity-100"></div>
          
          {/* Pink Square Accent */}        
          <div className="absolute aspect-[78/78] bg-[#e8117f] left-[150px] top-0 w-[32px] h-[32px]" />

          {/* Work AgentButton */}
          <button
            onClick={() => setShowWorkMenu(!showWorkMenu)}
            className="absolute font-medium text-white whitespace-nowrap hover:opacity-80 transition-opacity cursor-pointer"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "26px",
              fontWeight: 400,
              left: "187px",
              top: "-5px",
              fontVariationSettings: "'wdth' 100",
              background: "transparent",
              border: "none",
              padding: "0",
            }}
          >
            Work
          </button>

          {/* Hover Tooltip Menu */}
          {showWorkMenu && (
            <div
              className="absolute top-[70px] left-[20px] bg-[rgba(0,26,51,0.95)] rounded-lg shadow-lg border border-[#4190ff] z-50"
              style={{
                backdropFilter: "blur(10px)",
                minWidth: "180px",
              }}
            >
              {workMenuOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    handleMenuClick(option.route);
                    setShowWorkMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-[rgba(65,144,255,0.2)] transition-colors text-white border-b border-[rgba(65,144,255,0.2)] last:border-b-0 cursor-pointer"
                  style={{
                    fontFamily: "'Open Sans', sans-serif",
                    fontSize: "14px",
                  }}
                >
                  <span className="mr-2">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Box */}
        <SearchBox className="absolute w-[290px] h-[40px] left-[160px] -translate-x-1/2 top-[75px]" />

        {/* Account Section */}
        <div className="absolute right-[40px] top-[600px] flex items-center gap-2">
          <AccountProfileIcon />
          <p
            className="text-white whitespace-nowrap"
            style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: "20px",
              fontWeight: 400,
              fontVariationSettings: "'wdth' 100",
            }}
          >
            Account
          </p>
        </div>
      </div>

      {/* Circular Menu Section */}
      <div
        className="absolute left-[500px] top-[90px] w-[450px] h-[450px]"
        data-name="menu"
      >
        {/* Rim Background */}
        <img
          alt="menu rim"
          className="absolute inset-0 max-w-none object-cover opacity-30 pointer-events-none w-full h-full"
          src={imgRim1}
        />

      <svg className="absolute inset-0 w-full h-full overflow-visible">
  {[
    ...directoryItems,
    ...scheduleItems,
    ...connectItems,
    ...toolsItems,
    ...todoItems,
  ].map((item) => (
    <g key={item.id}>
      <defs>
        <path id={item.id} d={item.path} fill="transparent" />
      </defs>

      <text
        fill={item.color}
        fontSize="24"
        fontWeight="700"
        letterSpacing="2px"
        className="cursor-pointer hover:opacity-75 transition-opacity"
        style={{
          fontFamily: "'Open Sans', sans-serif",
        }}
        onClick={() => handleMenuClick(item.route)}
      >
        <textPath
          href={`#${item.id}`}
          startOffset="50%"
          textAnchor="middle"
        >
          {item.text}
        </textPath>
      </text>
    </g>
  ))}
        </svg>
        
        
        {/* Tools Section - Yellow */}
        <button
          onClick={() => handleMenuClick("/agents/notes")}
          className="absolute flex items-center justify-center hover:opacity-75 transition-opacity cursor-pointer"
          style={{
            left: "294.52px",
            top: "68.23px",
            background: "transparent",
            border: "none",
            padding: 0,
            width: "60px",
            height: "60px",
          }}
          title="Notes"
        >
          <div style={{ transform: "rotate(33.27deg)" }}>
            <p
              className="font-semibold leading-normal relative text-[#fdd300] whitespace-nowrap"
              style={{
                fontFamily: "'Open Sans', sans-serif",
                fontSize: "16px",
                fontVariationSettings: "'wdth' 100",
              }}
            >
              Notes
            </p>
          </div>
        </button>

        {/* To Do Items - Orange */}
        <button
          onClick={() => handleMenuClick("/dashboard")}
          className="absolute font-semibold text-[#fd6900] whitespace-nowrap hover:opacity-75 transition-opacity cursor-pointer"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "16px",
            fontVariationSettings: "'wdth' 100",
            left: "190px",
            top: "336px",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
          title="Incoming"
        >
          Incoming
        </button>
        <button
          onClick={() => handleMenuClick("/dashboard")}
          className="absolute font-semibold text-[#fd6900] whitespace-nowrap hover:opacity-75 transition-opacity cursor-pointer"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "16px",
            fontVariationSettings: "'wdth' 100",
            left: "189px",
            top: "356px",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
          title="Tasks List"
        >
          Tasks List
        </button>
        <button
          onClick={() => handleMenuClick("/dashboard")}
          className="absolute font-semibold text-[#fd6900] whitespace-nowrap hover:opacity-75 transition-opacity cursor-pointer"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "16px",
            fontVariationSettings: "'wdth' 100",
            left: "199px",
            top: "376px",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
          title="Boards"
        >
          Boards
        </button>

        {/* Connect Section - Purple */}
        <button
          onClick={() => handleMenuClick("/agents/family-life")}
          className="absolute font-semibold text-[#b67bfe] whitespace-nowrap hover:opacity-75 transition-opacity cursor-pointer"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "12px",
            fontVariationSettings: "'wdth' 75",
            left: "312px",
            top: "260px",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
          title="Communications"
        >
          <div style={{ transform: "rotate(-70.27deg)" }}>
            <p
              className="font-semibold leading-normal relative text-[#b67bfe] whitespace  nowrap"
              style={{
                fontFamily: "'Open Sans', sans-serif",
                fontSize: "14px",
                fontVariationSettings: "'wdth' 100",
              }}
            >
              Communications
            </p>
          </div>
        </button>
        <button
          onClick={() => handleMenuClick("/agents/family-life")}
          className="absolute font-semibold text-[#b67bfe] whitespace-nowrap hover:opacity-75 transition-opacity cursor-pointer"
          style={{
            fontFamily: "'Open Sans', sans-serif",
            fontSize: "16px",
            fontVariationSettings: "'wdth' 100",
            left: "325px",
            top: "260.50px",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
          title="Email"
        >
          <div style={{ transform: "rotate(-70.27deg)" }}>
            <p
              className="font-semibold leading-normal relative text-[#b67bfe] whitespace nowrap"
              style={{
                fontFamily: "'Open Sans', sans-serif",
                fontSize: "16px",
                fontVariationSettings: "'wdth' 100",
              }}
            >
              Email
            </p>
          </div>
        </button>
        </div>
    </div>
  );
}
