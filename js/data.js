/**
 * INSANE POWER ESPORTS - FREE FIRE WEEKLY WARS 48-SLOT & IDP SYSTEM DATA
 */

const IP_DATA = {
  orgInfo: {
    name: "INSANE POWER ESPORTS",
    shortName: "IP ESPORTS",
    tagline: "Dominating The Free Fire Battlegrounds | Weekly Wars 48-Slot Arena",
    established: "2023",
    location: "India",
    contactEmail: "weeklywars@insanepoweresports.in",
    supportWhatsapp: "+91 98765 43210",
    youtube: "https://youtube.com/@InsanePowerEsports",
    instagram: "https://instagram.com/insanepoweresports",
    twitter: "https://twitter.com/IPEsportsIN",
    stats: {
      warsHosted: "48+",
      prizeDistributed: "₹6,50,000+",
      registeredSquads: "1,400+",
      weeklyActiveGamers: "10,000+"
    }
  },

  // Pre-registered player accounts (for testing / platform members)
  seedPlayers: [
    {
      username: "thunder_igl",
      name: "Sameer Sheikh",
      ign: "IPãƒ»THUNDER",
      uid: "1948201948",
      phone: "+91 98765 43210",
      role: "Captain / IGL",
      registeredAt: "2026-09-01"
    },
    {
      username: "viper_sniper",
      name: "Aditya Nair",
      ign: "IPãƒ»VIPER",
      uid: "2048192847",
      phone: "+91 98765 43211",
      role: "Sniper",
      registeredAt: "2026-09-02"
    },
    {
      username: "blaze_rusher",
      name: "Rohan Varma",
      ign: "IPãƒ»BLAZE",
      uid: "1829471928",
      phone: "+91 98765 43212",
      role: "Entry Rusher",
      registeredAt: "2026-09-03"
    },
    {
      username: "shadow_ff",
      name: "Dev Singhania",
      ign: "IPãƒ»SHADOW",
      uid: "2291847192",
      phone: "+91 98765 43213",
      role: "Support / Cover",
      registeredAt: "2026-09-04"
    },
    {
      username: "cyborg_sub",
      name: "Kabir Khan",
      ign: "IPãƒ»CYBORG",
      uid: "2819472910",
      phone: "+91 98765 43214",
      role: "Substitute",
      registeredAt: "2026-09-05"
    }
  ],

  // 48-Slot Free Fire Weekly Wars Structure (4 Groups x 12 Squads = 4 Days)
  tournaments: [
    {
      id: "ww-ff-12",
      title: "FREE FIRE MAX WEEKLY WARS - SEASON 12",
      game: "Free Fire MAX",
      category: "weekly_wars",
      mode: "Squad (Battle Royale)",
      map: "Bermuda, Purgatory, Kalahari, Alpine (4 Matches / Day)",
      prizePool: "₹1,000",
      entryFee: "100% FREE",
      totalSlots: 48, // 48 Slots total
      slotsPerGroup: 12, // 12 squads per group/day
      totalGroups: 4, // Day 1 to Day 4
      filledSlots: 26,
      status: "open",
      badgeText: "48 SLOTS (4 DAYS)",
      schedule: "Day 1 (Thu), Day 2 (Fri), Day 3 (Sat), Day 4 (Sun) @ 6:00 PM IST",
      bannerImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
      description: "48 Squads divided into 4 Days (12 squads per group). ₹1,000 Weekly Wars Prize Pool with exclusive Day-Wise Room IDP access!",
      groupSchedule: [
        { group: "Group A (Day 1)", slots: "Slots 1 - 12", day: "Thursday @ 6:00 PM IST", status: "Active Today" },
        { group: "Group B (Day 2)", slots: "Slots 13 - 24", day: "Friday @ 6:00 PM IST", status: "Upcoming" },
        { group: "Group C (Day 3)", slots: "Slots 25 - 36", day: "Saturday @ 6:00 PM IST", status: "Upcoming" },
        { group: "Group D (Day 4)", slots: "Slots 37 - 48", day: "Sunday @ 6:00 PM IST", status: "Upcoming" }
      ],
      prizeBreakdown: [
        { rank: "1st Place (Champions)", prize: "₹600 + Slot Verification" },
        { rank: "2nd Place (Runner-Up)", prize: "₹300" },
        { rank: "Tournament MVP", prize: "₹100" }
      ],
      pointSystem: [
        { place: "1st (Booyah)", pts: 12 },
        { place: "2nd", pts: 9 },
        { place: "3rd", pts: 8 },
        { place: "4th", pts: 7 },
        { place: "5th", pts: 6 },
        { place: "6th", pts: 5 },
        { place: "7th", pts: 4 },
        { place: "8th", pts: 3 },
        { place: "9th", pts: 2 },
        { place: "10th", pts: 1 },
        { place: "11th - 12th", pts: 0 },
        { place: "Per Elimination (Kill)", pts: "1 pt" }
      ],
      rulesSummary: [
        "48 Total Slots divided line-wise into 4 Groups (12 Squads per Day).",
        "Gun Attributes: Strictly OFF.",
        "Character Skills: Allowed as per official FFIC esports rules.",
        "Only Mobile Phones allowed (Strictly NO PC Emulators, iPads, or Triggers).",
        "Exclusive IDP Security: Only the 12 Captains playing on the active match day can unlock the Room ID & Password!",
        "Room ID & Pass are released 15 minutes before the match start time."
      ]
    }
  ],

  // Default IDP Broadcast Settings (Managed by Admin)
  idpSettings: {
    activeDay: 1, // 1 = Group A, 2 = Group B, 3 = Group C, 4 = Group D
    activeGroupName: "Group A (Day 1)",
    isReleased: true,
    roomId: "8492019",
    roomPass: "IP777",
    matchTime: "6:00 PM IST",
    mapRotation: "Bermuda, Purgatory, Kalahari, Alpine"
  },

  // Points Table
  leaderboards: {
    season: "FREE FIRE WEEKLY WARS - SEASON 12 FINALS",
    isPublished: false,
    mvp: null,
    standings: []
  },

  faqs: [
    {
      q: "How are the 48 slots divided across the 4 match days?",
      a: "As squads register in order: Slots 1–12 are assigned to Day 1 (Group A), Slots 13–24 to Day 2 (Group B), Slots 25–36 to Day 3 (Group C), and Slots 37–48 to Day 4 (Group D)."
    },
    {
      q: "Who gets access to the Room ID & Password (IDP)?",
      a: "Strict Day-Wise Access Control is enforced! Only the 12 Captains/IGLs whose group is scheduled for that day will be able to unlock and view the Room ID & Password. Other groups' IDPs remain securely locked until their respective match day."
    },
    {
      q: "How do I check my squad's match day and slot?",
      a: "Once registered, your digital Match Pass displays your assigned Slot Number (e.g. Slot #7), Group (e.g. Day 1 / Group A), and scheduled match day."
    },
    {
      q: "Are Gun Attributes and Character Skills ON or OFF?",
      a: "Gun Attributes are STRICTLY OFF. Character skills are allowed as per official FFIC rules."
    }
  ]
};

// Storage Keys
const USERS_STORAGE_KEY = "IP_FF_USERS_V3";
const SQUADS_STORAGE_KEY = "IP_FF_PERMANENT_SQUADS_V3";
const CURRENT_USER_SESSION_KEY = "IP_FF_CURRENT_USER_SESSION_V3";
const REGISTRATION_STORAGE_KEY = "IP_FF_WEEKLY_WARS_REGISTRATIONS_V3";
const IDP_SETTINGS_STORAGE_KEY = "IP_FF_IDP_SETTINGS_V3";
const STANDINGS_STORAGE_KEY = "IP_FF_WEEKLY_WARS_STANDINGS_V3";

