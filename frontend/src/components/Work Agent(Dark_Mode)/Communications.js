import { useState } from 'react';
import { Plus, Video } from 'lucide-react';
import speechbubble1 from '../../assets/speechbubble1.png';
import zoom2 from '../../assets/zoom2.png';
import teams from '../../assets/teamscolor2.png';
import jira from '../../assets/jiracolor2.png';
import slack from '../../assets/slackcolor2.png';
import list3 from '../../assets/list3.png';
import paper1 from '../../assets/paper1.png';
import text1 from '../../assets/text1.png';
import clipboard3 from '../../assets/clipboard3.png';
import link1 from '../../assets/link1.png';



export default function Communications() {
    const [connectedAccounts, setConnectedAccounts] = useState([]);
   return (
  <div className="w-full h-screen relative bg-sky-950 overflow-hidden">

    {/* ── Top bar ── */}
    <div className="flex items-center justify-between px-[50px] pt-[35px]">
               <span className="text-white text-3xl font-bold font-['Space_Mono']">Work</span>
               <div className="w-20 h-12 left-[50px] top-[19px] absolute border-b-[3px] border-pink-600" />

      <span className="text-white text-base font-['Open_Sans']">Account</span>
    </div>

    {/* ── Sidebar label ── */}
    <div className="absolute left-[149px] top-[130px] flex items-center gap-2">
      <img className="w-6 h-6" src={speechbubble1} alt="Communications" />
      <span className="text-white text-sm font-semibold font-['Inter']">Communications</span>
    </div>

    {/* ── Connect accounts list ── */}
           <div className="absolute left-[439px] top-[185px]">
               <div className="w-[789px] h-0 left-[269px] top-[10px] bottom-[130px] absolute origin-top-left rotate-90 outline outline-1 outline-white/30"></div>
      <p className="text-white text-xs font-semibold font-['Open_Sans'] mb-4">Connect an account</p>
      <button className="flex flex-col gap-2.5">
        {[
          { src: slack,  alt: 'Slack',            label: 'Slack'  },
          { src: jira,   alt: 'Jira',             label: 'Jira'   },
          { src: teams,  alt: 'Microsoft Teams',  label: 'Teams'  },
          { src: zoom2,  alt: 'Zoom',             label: 'Zoom'   },
        ].map(({ src, alt, label }) => (
          <div key={label} className="w-56 relative rounded-[10px]">
            <div className="flex items-center gap-3 pb-2.5">
              <img className="w-6 h-6" src={src} alt={alt} />
              <span className="text-white text-base font-normal font-['Open_Sans']">{label}</span>
            </div>
            <div className="w-full h-px bg-white/30" />
          </div>
        ))}
      </button>
    </div>

    {/* ── Main message panel ── */}
    <div className="absolute left-[729px] top-[185px] w-[981px] h-[699px] bg-white/5 rounded-[10px] outline outline-1 outline-white/50">

      {/* Vertical divider */}
      <div className="absolute left-0 top-0 w-px h-full bg-white/30" />

               {/* Message content area */}
       {/* {!connectedAccounts ? */}(                                           // remove once logic is connected
        <div className="absolute inset-0 flex items-center justify-center px-10">
          <p className="text-white text-md text-center font-semibold font-['Space_Mono']">
            Connect Slack, Teams, and other available messaging platforms.
          </p>
        </div>
      ) : (
        <div className="absolute left-[30px] top-[30px] w-[400px] text-white text-xs font-semibold font-['Open_Sans']">
          Lorem ipsum lorem ipsum
        </div>
      )}

      {/* ── Compose area ── */}
      <div className="absolute bottom-0 left-0 right-0">

        {/* Top border row */}
        <div className="w-full h-7 rounded-tl-[10px] rounded-tr-[10px] border-l border-r border-t border-white/20" />

        {/* Compose box */}
        <div className="w-full bg-white/10 rounded-bl-[10px] rounded-br-[10px] outline outline-1 outline-white/20 px-5 pt-3 pb-4">

          {/* Placeholder */}
          <p className="text-white/60 text-xs font-normal font-['Open_Sans'] mb-4">Start a new message . . .</p>

          {/* Bottom toolbar row */}
                       <div className="flex items-center gap-2.5">
                           <button>
                               <img className="w-5 h-5" src={paper1} alt="Attachments" />
                           </button>
            <button className="text-white text-xl font-normal font-['Open_Sans']">@</button>
                           <div className="w-px h-5 bg-white/20" />
                           <button>
                               <Video className="w-4 h-4 text-white" />
                           </button>
            <div className="w-px h-5 bg-white/20" />
            <button className="text-white text-xs font-semibold font-['Open_Sans']">B</button>
            <button className="text-white text-xs font-normal font-['Open_Sans'] italic">I</button>
            <button className="text-white text-xs font-normal font-['Open_Sans'] underline">U</button>
            <button className="text-white text-xs font-normal font-['Inter']">&lt;/&gt;</button>
            <div className="w-px h-5 bg-white/20" />
           <button> <img className="w-5 h-5" src={list3} alt="Bullet list" /></button>
           <button> <img className="w-3.5 h-3.5" src={text1} alt="Numbered list" /></button>
           <button> <img className="w-4 h-4" src={clipboard3} alt="Clipboard" /></button>
            <div className="w-px h-5 bg-white/20" />
           <button> <img className="w-4 h-4" src={link1} alt="Link" /></button>
          </div>
        </div>
      </div>
    </div>

    {/* ── Compose button ── */}
    <div className="absolute left-[643px] top-[844px] w-7 h-7 bg-white/40 rounded-[5px] flex items-center justify-center cursor-pointer hover:bg-white/50 transition-colors">
      <div className="flex flex-col gap-0.5">
        {/* <div className="w-3.5 h-3.5 bg-white" /> */}
        <Plus className="w-6 h-6 text-white" />
        
      </div>
    </div>

    {/* ── Wordmark ── */}
    <div className="absolute left-[60px] bottom-[40px] text-white/80 text-6xl font-bold font-['Open_Sans'] tracking-[6px]">
      Idii.
    </div>

  </div>
);
}