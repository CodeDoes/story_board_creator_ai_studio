/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  User, 
  LayoutGrid, 
  Play, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  FileText,
  Settings,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  MapPin,
  Clapperboard,
  Zap,
  Download,
  Layout,
  Box,
  Check,
  Key
} from 'lucide-react';
import { get, set, clear } from 'idb-keyval';
import { GoogleGenAI } from "@google/genai";
import { generateProductionAsset } from './services/gemini';
import { generateScriptLayout } from './services/layoutService';
import { PageData, Panel, Character, Prop, GenerationResult, ActivePanel, GenerationMode } from './types';
import { Toast } from './components/Toast';
import { IntentBox } from './components/IntentBox';
import { ReferenceCard } from './components/ReferenceCard';
import { ImageModal } from './components/ImageModal';

// --- CONSTANTS ---

const GLOBAL_STYLE = "Universal cinematic 35mm film still, sharp focus, authentic textures, natural lighting, deep shadows, anamorphic lens, high-fidelity details. No illustration, no cartoon styles, no blur.";
const SUBTITLE_STYLE = "White cinematic subtitle text centered at the bottom of the frame for any dialogue.";

const DEFAULT_STORYBOARD: PageData[] = [
  {
    "id": 1,
    "title": "The Awakening & Arrival",
    "sequence": "Sequence 1",
    "priority": "high",
    "loc": {
      "title": "The Liminal - Crew Quarters & Cockpit",
      "prompt": "Interior of a cramped, dark spaceship sleeping cabin transitioning into a functional cockpit with a wide viewport. Metal panels covered in 20 years of modifications, cable runs, and flickering blue-green status lights."
    },
    "chars": ["kael"],
    "props": ["liminal"],
    "frames": [
      { "id": 1, "priority": "highlight", "prompt": "Extreme macro shot of Kael's eye snapping open in the dark. Holographic data strings and a blue-green LED status light reflect in his wet iris." },
      { "id": 2, "priority": "standard", "prompt": "Kael sits up, the cabin lights flickering to life. He rubs his face, exhausted." },
      { "id": 3, "priority": "standard", "prompt": "Kael climbs into the pilot's seat, the console humming as he initiates the power-up sequence." },
      { "id": 4, "priority": "highlight", "prompt": "Wide shot through the cockpit viewport. The massive, skeletal structure of Kepler Station looms against the backdrop of a swirling gas giant. The Liminal's nose is visible in the foreground." },
      { "id": 5, "priority": "standard", "prompt": "The ship's thrusters fire, small blue plumes visible in the dark." },
      { "id": 6, "priority": "standard", "prompt": "Kael checks his navigation console, his face illuminated by the green glow." },
      { "id": 7, "priority": "standard", "prompt": "The Liminal approaches the station's docking arm." },
      { "id": 8, "priority": "standard", "prompt": "A close-up of the ship's docking port extending." },
      { "id": 9, "priority": "standard", "prompt": "The station's docking bay doors slowly open." },
      { "id": 10, "priority": "standard", "prompt": "The Liminal enters the hangar, the station's interior visible." },
      { "id": 11, "priority": "standard", "prompt": "The ship settles into the docking cradle." },
      { "id": 12, "priority": "standard", "prompt": "The main engines shut down, the blue glow fading." },
      { "id": 13, "priority": "standard", "prompt": "Kael unbuckles his harness and prepares to disembark." },
      { "id": 14, "priority": "highlight", "prompt": "Close up of massive hydraulic docking clamps slamming shut onto The Liminal's hull. Sparks fly and steam erupts from the pressure seal." },
      { "id": 15, "priority": "standard", "prompt": "The airlock cycles, a hissing sound filling the cockpit." },
      { "id": 16, "priority": "highlight", "prompt": "Medium shot. Kael steps off the ramp into the bay. Tomas and Yuki, two station mechanics in greasy coveralls, wait for him with suspicious expressions." }
    ]
  }
];

const SCRIPT_INGEST_PROMPT_TEMPLATE = `Analyze this raw script and merge it into the current production storyboard.
        
CURRENT PRODUCTION DATA:
{{CURRENT_CONTEXT}}

NEW SCRIPT CONTENT:
{{RAW_SCRIPT}}

INSTRUCTIONS:
1. Break down the ENTIRE script into logical story beats (storyboard items).
2. Each story beat should represent a specific location and sequence of action.
3. For EACH story beat, you MUST generate EXACTLY 16 distinct frames that cover the action in that beat.
4. Maintain visual continuity for existing characters, locations, and key props.
5. Generate detailed visual prompts for new elements.
6. Provide a summary for each sequence (new or updated).
7. If the script is long, ensure you process ALL of it, creating multiple storyboard items as needed. Do not stop after the first scene.

Return a COMPLETE NEW JSON object with:
1. "masterChars": Record<string, { name: string, prompt: string }> - All characters in the production.
2. "masterProps": Record<string, { name: string, prompt: string }> - Key objects, ships, or items that need visual consistency.
3. "sequenceSummaries": Record<string, string> - A brief overview of what each sequence is about.
4. "storyboard": Array<{
     id: number,
     title: string,
     sequence: string,
     priority: "high" | "low",
     loc: { title: string, prompt: string },
     chars: string[], // IDs from masterChars
     props: string[], // IDs from masterProps
     frames: Array<{ id: number, prompt: string, priority: "highlight" | "standard" }> // Exactly 16 frames per beat. Exactly 4 must be "highlight".
   }>

CRITICAL: Ensure prompts are highly descriptive for cinematic generation. Use the provided style templates if applicable. The output MUST be valid JSON.`;

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [storyboard, setStoryboard] = useState<PageData[]>(DEFAULT_STORYBOARD);
  const [storyboardAspectRatio, setStoryboardAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("16:9");
  const [sequenceSummaries, setSequenceSummaries] = useState<Record<string, string>>({
    "Sequence 1": "Kael Vasaro wakes up in his cramped quarters on The Liminal, preparing for another day of survival in deep space."
  });
  const [rawScript, setRawScript] = useState(`Title: TETHER
Credit: Episode 1
Author: Created for Tether Productions
Draft date: January 2026

====

FADE IN:

INT. THE LIMINAL - CREW QUARTERS - DEEP SPACE

DARKNESS. Then--

The soft PING of a ship's system waking up. Status lights blink to life in sequence, casting blue-green shadows across a cramped bunk.

KAEL VASARO (mid-40s) lies on his back, eyes closed. His face is weathered but not hard--more tired than bitter. Graying hair, disheveled, poorly cut. The kind of man who stopped caring about appearances around the same time he stopped caring about most things.

He doesn't move. The ship HUM surrounds him like a blanket.

LIMINAL (V.O.)
(ship AI, female, flat)
Transit complete. Kepler Station approach confirmed. Docking window in forty-three minutes.

Another PING. More insistent.

Kael's eyes open. He stares at the ceiling--metal panels covered in twenty years of modifications. Cable runs. Personal touches. A photograph tucked into a joint seam, too faded to read from here.

He exhales. Not a sigh--just breathing. The first breath of another day that doesn't require anything from him.

A grunt. He sits up slowly. Every joint in his body protests. He ignores it.

The quarters are TIGHT. A bunk barely wide enough for his shoulders. Storage compartments built into every surface. A fold-down desk with a console. Everything within arm's reach.

Twenty years on this ship. Twenty years of wear patterns. Twenty years of making this space HIS.

Kael swings his legs off the bunk. His bare feet touch the deck plating--cold metal, familiar. The HUM rises through his soles.

He reaches for a COFFEE MAKER mounted to the wall. It's been repaired so many times the original parts are probably outnumbered. He hits a button. It GURGLES and HISSES, then produces something approximately like coffee.

He drinks it standing, staring at nothing.

The coffee maker falls silent. The HUM remains--always the HUM.

LIMINAL (V.O.)
Atmospheric recycling at optimal--

KAEL
Mute.

Silent again but for the HUM.

INT. THE LIMINAL - COCKPIT - CONTINUOUS

Kael moves forward through the narrow corridor. The cockpit is small but functional--pilot's chair, nav console, wide viewport.

Through the glass: STARS. Endless. And in the distance, growing larger, the rotating ring of KEPLER STATION. Gray metal against black void. Running lights blinking. Ships dotting the approaches like fireflies.

Kael settles into the pilot's chair. It's molded to his body after two decades.

LIMINAL (V.O.)
Docking beacon acquired. Lane assignment: Berth 17-C.

KAEL
(flat)
Accepted.

His voice is rough from disuse.

The station grows in the viewport. A pit stop. Fuel, supplies, and gone.

EXT. KEPLER STATION - DOCKING ARM - LATER

The Liminal slides into her berth. DOCKING CLAMPS engage with a solid THUNK. Umbilicals extend and connect--power, data, atmo.

The ship settles and goes quiet.

INT. THE LIMINAL - AIRLOCK - CONTINUOUS

Kael stands at the inner door, waiting for pressure equalization. He's dressed now--practical spacer clothes. Worn jacket, navy blue pants, boots that have seen a thousand station decks. A SIDEARM on his hip, holstered but visible. Normal out here.

He reaches toward a small port near the inner door, unplugs something, and slips it onto his wrist--an unremarkable metal bracelet.

The airlock cycles and the outer door opens.

INT. KEPLER STATION - DOCK CORRIDOR - CONTINUOUS

Kael steps out into the station.

The difference is immediate. A draft of recycled air. Distant mechanical noise. The sterile hum of a place built for function, not comfort.

The dock corridor stretches ahead--wide, clinical, busy in its own way:

-- CARGO BOTS roll past, their chassis scratched and dented. Some move in formation. Others navigate solo, weaving around obstacles.

-- SHIPS of various sizes fill the visible berths. A battered freighter getting its hull patched. A sleek courier vessel with engine panels open. A salvage rig that looks like it was assembled from three different ships.

-- PEOPLE. Dock workers in coveralls. Pilots in flight suits. Merchants. Mechanics. Drifters. Everyone has somewhere to be.

-- MORE BOTS THAN PEOPLE. Service units polishing viewport glass. Maintenance drones crawling along cable runs overhead. Delivery bots weaving between legs. The human-to-machine ratio tilted heavily toward machine.

Kael walks. Not fast, not slow. He weaves wide around other people, giving them too much space. His face says he'd rather be anywhere else.

A CLEANING BOT crosses his path, scrubbing a fuel stain from the deck. He steps around it without slowing.

MARKET STALLS line the corridor walls. Synthetic protein in various shapes. Hydroponic vegetables. Stimulants. Questionable electronics. A man selling "genuine Earth artifacts" that are obviously printed fakes.

The AIR smells like recycled atmo, machine oil, and something cooking with too much spice. The station's ventilation hums overhead, a constant bass note beneath the chaos.

Kael passes a NEWS DISPLAY mounted to a pillar. A talking head mouths silently--some political story. He doesn't look.

EXT. KEPLER STATION - REPAIR BAY 12 - CONTINUOUS

A workshop space open to the dock corridor. Tools hanging on pegboards. Ship components on workbenches. The organized chaos of people who know where everything is.

TOMAS (50s, barrel-chested, practical) is elbow-deep in an engine housing. His husband YUKI (50s, lean, patient face, graying temples) works at a diagnostic console nearby.

Kael approaches. Tomas looks up. His face splits into a grin.

TOMAS
Vasaro. You look like shit.

KAEL
Long haul.

Tomas wipes his hands on a rag.

TOMAS
Where from?

KAEL
Belt. The far side.

YUKI
(without looking up)
The Liminal holding up?

KAEL
Always does.

TOMAS
Got a coupling that'd fit your starboard thruster.

Kael raises an eyebrow slightly. Waiting.

TOMAS (CONT'D)
Fell off a transport. Legally.

KAEL
How much?

TOMAS
For you? Cost plus ten.

KAEL
I'll think about it.

YUKI
(still not looking up)
You always think about it. Then you buy it.

The corner of Kael's mouth twitches.

TOMAS
You eating?

KAEL
Getting to it.

TOMAS
Ming's is good today. The noodles.

Kael nods and moves on.

EXT. KEPLER STATION - FOOD STALL CORRIDOR - CONTINUOUS

A narrow passage lined with cooking stations. Steam and smoke. The SIZZLE of protein on hot metal. VENDORS calling out in multiple languages.

Kael stops at a stall run by an OLD WOMAN with cybernetic eyes. Her movements are precise despite her age. She's cooking something unidentifiable--meat, probably. It smells good enough.

OLD WOMAN
The usual?

Kael nods.

She works fast. Skewered protein, some kind of sauce, wrapped in synthetic bread. She hands it to him. He pays with a tap of his wrist.

OLD WOMAN (CONT'D)
You're back soon.

KAEL
Needed supplies.

OLD WOMAN
Don't we all.

He takes his food. Eats it walking. The protein is chewy, overseasoned, exactly what he expected. It's fine. Fine is enough.

EXT. KEPLER STATION - OBSERVATION DECK - CONTINUOUS

A small platform with a viewport looking out at the station's exterior. Ships coming and going. The distant glow of the belt.

Kael stands here, finishing his food. Watching.

TWO WORKERS pass behind him. Young but tired. Together, but you can't tell if they're a couple or just two people on a job.

Kael watches them go.

A SECURITY BOT rolls past, scanning faces. Its red eye lingers on Kael for a moment, then moves on.

He finishes eating. Balls up the wrapper. Drops it in a recycler.

Heads back to his ship.

INT. THE LIMINAL - COCKPIT - LATER

Kael settles back into his chair.

He pulls up the JOB BOARD on his console. Listings scroll past:

-- "Cargo run to Titan Station - 4 weeks - Standard rate"
-- "Salvage claim dispute escort - Combat certification required"
-- "Medical supplies to Belt Colony 7 - Priority transit"
-- "Data courier - Origin: Earth - Destination: Classified"

He scrolls. Stops on one.

LISTING (ON SCREEN)
"Mineral samples - Kepler to Ceres Outpost. 3 weeks transit. Rate: 12,000 credits. No questions."

Good enough. He accepts it. The confirmation pings.

LIMINAL (V.O.)
Route calculation initiated. Estimated transit time: 19 days, 4 hours.

KAEL
Start it.

While the nav computer works, he pulls up a secondary display. Tabs through options. Lands on: NEWS FEED.

He doesn't know why he does it.

INT. THE LIMINAL - COCKPIT - CONTINUOUS

The feed fills his screen. Talking heads. Graphics. The endless churn.

HEADLINE CRAWLER: "LOCKE CAMPAIGN IN FREEFALL AFTER FUNDING REVELATIONS"

Kael's eyes flick to the story. A VIDEO plays:

VANESSA LOCKE (50s, composed, professional) stands at a podium. She looks tired.

NEWS ANCHOR (V.O.)
(from the feed)
Independent candidate Vanessa Locke suspended her campaign today amid escalating allegations of financial impropriety--

Kael taps to another channel. Different talking head. Different angle.

NEWS ANCHOR 2 (V.O.)
--the progressive coalition has called for a full investigation into what they're calling "a shocking betrayal of stated values"--

Another tap. Another channel.

NEWS ANCHOR 3 (V.O.)
--conservative groups are demanding accountability, citing Locke's alleged ties to globalist banking interests--

His fingers stop on the screen. He taps through more feeds:

CHANNEL 7: "LOCKE EXPOSED: Dark money ties reveal centrist fraud"

NEWSNET: "LOCKE UNMASKED: Progressive policies funded by offshore elites"

Same footage. Same woman.

KAEL
(barely audible)
Yeah.

He closes the political feeds. Scrolls past them. Station updates. Shipping manifests. Celebrity gossip. An ad for memory enhancement implants.

The usual churn.

Then--

He stops scrolling.

HEADLINE (ON SCREEN)
"Federal Auditor Dies in New Francisco Apartment Fire. Twin Sister Survived."

Kael stares at it.

His finger hovers over the screen.

CLOSE ON his eyes.

He taps the story.

INT. THE LIMINAL - COCKPIT - CONTINUOUS

The article expands:

TEXT (ON SCREEN)
"...Federal Accounts Division employee found deceased following residential fire in the Tenderloin district of New Francisco. The cause of the blaze remains under investigation. The victim's twin sister, who was present at the time, escaped with minor injuries and is cooperating with authorities..."

New Francisco. Twin sister.

Kael's face is very still.

KAEL
(quiet)
No.

(to the ship)
Marcus Oyelaran. Pull up his profile.

The screen populates. MARCUS OYELARAN. Thoughtful eyes. The kind of face that doesn't give much away. Current position: "Senior Auditor, Federal Accounts Division, Western Region."

Kael stares at the photo.

KAEL
(quiet)
Shit, Marcus.

FLASHBACK - QUICK CUTS:

-- TEXT on a screen: "You awake?" "Yeah. Can't sleep." "Same. What time is it there?" "Late."

-- A voice message, MARCUS's voice: "Called about the thing. They're stonewalling. Surprise surprise."

-- Another text exchange: "You ever think about just... leaving?" "And do what? Federal auditing doesn't exactly transfer to the belt colonies. All I know is spreadsheets and fraud patterns."

-- A later message, Marcus again: "Besides. Dad's latest scheme fell apart. Again. Someone's gotta help Mom keep the lights on. Not all of us are as free as you."

BACK TO PRESENT:

Kael's hand is trembling slightly. He steadies it.

LIMINAL (V.O.)
Route calculation complete. Ready to depart.

Kael doesn't move.

He reads the article again. "Apartment fire." "Cause under investigation." "Twin sister survived."

His hand hovers over the screen, not quite steady.

LIMINAL (V.O.)
Awaiting departure confirmation.

Kael reaches for the console. His finger hovers over the "Confirm" button.

He doesn't press it.

Instead, he opens the nav system. Cancels the job.

LIMINAL (V.O.)
Job canceled. Penalty fee applied to account.

Kael ignores it. He's already typing a new destination.

NEW DESTINATION (ON SCREEN): EARTH - NEW FRANCISCO APPROACH - PRIORITY TRANSIT

LIMINAL (V.O.)
Warning: Earth transit requires current documentation and landing permits. Your credentials have not been updated in--

KAEL
Override.

LIMINAL (V.O.)
Calculating priority route. Estimated transit: 11 days.

KAEL
Do it.

He hits the release sequence. The docking clamps DISENGAGE.

EXT. KEPLER STATION - DOCKING ARM - CONTINUOUS

The Liminal pulls away from the berth. Umbilicals disconnect and retract. The ship pivots, nose orienting toward the void.

INT. THE LIMINAL - COCKPIT - CONTINUOUS

Kael watches the station shrink in the viewport. His hands rest on the controls, not moving.

KAEL
(quiet)
What did you find, Marcus?

EXT. SPACE - CONTINUOUS

The Liminal accelerates. Her engines flare bright, then brighter.

Kepler Station dwindles behind her. The ship becomes a point of light, streaking toward the distant inner system.

Toward Earth.

Toward a place Kael stopped thinking about a long time ago.

TITLE CARD:

T E T H E R

The title BURNS IN, then FADES slowly as the ship's light disappears into the black.

FADE TO:

INT. THE LIMINAL - CREW QUARTERS - LATER

Kael asleep in his bunk. Dead to the world.

A PING from the ship's system. He doesn't move.

Another PING. His hand reaches out, slaps the console. Silence.

He settles back into sleep.

The coffee maker GURGLES to life on its timer. HISSES. SPUTTERS. The smell of something approximately like coffee fills the quarters.

Kael's eyes open. He stares at the ceiling. Exhales.

Drags himself up.

INT. THE LIMINAL - COCKPIT - LATER

Kael in the pilot's chair, coffee in hand. Through the viewport: Earth, filling the view.

LIMINAL (V.O.)
Approaching Earth orbital space. Traffic control handoff initiated.

Kael straightens in his chair.

LIMINAL (V.O.)
Be advised: Documentation check required at orbital checkpoint.

KAEL
What's our status?

LIMINAL (V.O.)
Your credentials show last planetary landing: twenty years, three months, seven days ago. System flagged for manual review.

KAEL
And?

LIMINAL (V.O.)
Review completed. Landing permit approved. Note attached: "Welcome back."

Kael says nothing. Welcome back. The two least appropriate words in any language.

EXT. EARTH ORBIT - CONTINUOUS

The Liminal slides into a berth at a massive ORBITAL STATION. Docking clamps engage. The ship is SCANNED by multiple sensor arrays. Transponder exchanges happen automatically.

Through the viewport: Earth. Kael doesn't linger on it.

INT. ORBITAL STATION - SHUTTLE TERMINAL - LATER

Kael moves through the crowded terminal. Travelers everywhere--business suits, family groups, laborers heading down for contract work. He finds his gate and boards a surface shuttle with forty other passengers.

INT. SURFACE SHUTTLE - CONTINUOUS

Kael sits by a window, head against the glass. The shuttle detaches, angles toward atmosphere. His eyes are half-closed, bleary. He could be asleep.

EXT. NEW FRANCISCO - LOWER DISTRICT - TRANSIT STATION - DUSK

Underground platform. Kael emerges from a TRANSIT CAR with a crowd of commuters. He moves through the turnstiles, up the stairs, onto the street.

The Lower District. Old buildings, dense blocks, infrastructure that was state-of-the-art two decades ago.

He checks his sidearm. Takes a breath. Starts walking.

EXT. NEW FRANCISCO - LOWER DISTRICT - STREET - CONTINUOUS

Kael steps into the flow of foot traffic.

The ASSAULT is immediate.

SOUND: Traffic. Voices. Music bleeding from storefronts. Advertisements. Sirens in the distance. The hum of a thousand machines. The never-ending PULSE of a city that never stops.

SMELL: Exhaust. Synthetic food. Rain on hot pavement. A chemical sweetness that might be perfume or might be pollution.

SIGHT: People EVERYWHERE. Packed onto sidewalks. Spilling out of buildings. Moving in streams and eddies around obstacles. All of them looking at screens. All of them somewhere else.

Kael stands very still.

A PEDESTRIAN bumps into him, doesn't apologize, keeps walking, eyes never leaving their wrist display.

Another pedestrian. Another. Everyone walking blind, trusting their peripheral vision.

Kael starts walking. His body language is WRONG here. Too much space around his movements. Too much awareness of his surroundings. He looks like what he is--an outsider.

A BEGGAR reaches toward him from a doorway. Kael sidesteps without acknowledgment. The beggar doesn't seem to notice.

The NOISE is worse than he remembered. Speakers on every corner. Music bleeding from storefronts. A hundred conversations layered on top of each other.

From a storefront speaker, a PODCAST bleeds into the street:

PODCAST HOST (V.O.)
--and that's exactly what they want you to think. The moderates are the real extremists, because they enable--

From another direction, an AD plays on loop:

ADVERTISEMENT (V.O.)
They said I could trust them! Don't make my mistake. TrustVer--because in a world of deep fakes, you deserve to know what's real.

Kael reaches into his jacket. Pulls out a pair of NOISE-CANCELLING HEADPHONES. Old model, well-worn. He puts them on.

The world goes QUIET.

BROWN NOISE fills his ears--the steady, familiar hum. Like The Liminal's systems. Like home.

He walks faster. The chaos continues around him, but he's insulated now. Safe in his bubble.

He passes a STREET PREACHER on a corner, mouth moving silently--Kael can't hear a word. The preacher gestures wildly at nothing. Nobody's listening. Bots clean around his feet without slowing.

Kael turns down a side street. Narrower. Darker. The buildings press closer. Fire escapes zigzag overhead. LAUNDRY hangs from windows. The first signs of actual human habitation.

He checks his wrist unit. A MAP displays. Destination highlighted.

KAEL
(quiet)
Three more blocks.

He keeps moving.

EXT. NEW FRANCISCO - TENDERLOIN DISTRICT - MARCUS'S BUILDING - NIGHT

The address.

A residential tower, maybe fifteen stories. Old but maintained. The kind of place working people live--too poor to leave, too stable to fall further.

Kael stands across the street, looking up.

THIRD FLOOR. The window of Marcus's unit is BLACKENED. Scorch marks spread up the exterior like fingers reaching toward the sky. A section of wall is MISSING--exposed framework, charred insulation.

The surrounding windows are intact. Other units undamaged.

Yellow caution tape hangs from the building entrance. One strip has been cut.

Kael removes his headphones and lets them hang around his neck. The street sounds rush in.

Kael checks his surroundings. The street is sparse--a few pedestrians, none paying attention. A FOOD VENDOR packing up for the night. A DRONE passing overhead, sweeping the area with a spotlight before moving on.

He crosses the street.

INT. MARCUS'S BUILDING - LOBBY - CONTINUOUS

The lobby is small and worn. A SECURITY DESK sits empty--the screen showing a maintenance notice. "Guard station unstaffed during off-hours. All visitors must register via mobile app."

Kael doesn't register. He walks past, toward the elevators.

One elevator is OUT OF SERVICE--taped off. The other is working. He takes it.

INT. MARCUS'S BUILDING - ELEVATOR - CONTINUOUS

Kael stands alone as the car rises, watching his reflection in the polished metal door.

The elevator PINGS. Third floor.

INT. MARCUS'S BUILDING - THIRD FLOOR HALLWAY - CONTINUOUS

The doors open. The SMELL hits first.

Burnt plastic. Charred wood. The lingering chemical bite of fire suppressant. Under it all, something organic. Something wrong.

Kael steps out.

The hallway is dimly lit--half the fixtures dead, casualties of the fire. SOOT stains the walls near Marcus's unit. The carpet is discolored, water-damaged.

Marcus's door is at the end.

It's OPEN. The frame warped, the lock mechanism melted into uselessness. More caution tape--cut, hanging loose.

Kael draws his sidearm and moves quietly to the doorway. Listens.

VOICES inside. Low, annoyed.

VOICE 1 (O.S.)
(muffled through a face mask)
Negative on the desk. Already cleared.

VOICE 2 (O.S.)
Check the vents. These places always have dead space.

Kael edges closer. Looks through the gap.

INT. MARCUS'S APARTMENT - CONTINUOUS

The apartment is DESTROYED. Fire damage everywhere--walls black, furniture melted or collapsed, ceiling panels hanging loose. Water damage has made the floor treacherous.

TWO FIGURES pick through the wreckage. Police gear, no badges. One yanks at a vent cover, impatient. The other paws through a collapsed bookshelf, helmet light bobbing, barely seeing what his hands are touching.

A duffel bag on the floor, half-full of random salvage.

Kael's eyes scan the room. The layout is visible despite the damage--living area, kitchenette, doorway to what must have been a bedroom. Personal effects reduced to ash and fragments.

Then he sees it.

On a WARPED SHELF near where a bathroom once was--half-melted, discolored, but intact--a small PLASTIC CASE. Rectangular. Hinged.

A contact lens holder.

FLASHBACK - QUICK:

KAEL (V.O.)
(from an old message, teasing)
Got you something. Contacts would suit you better. Make you look less like someone's grandfather.

MARCUS'S VOICE (V.O.)
(dry)
It's a contact lens case.

KAEL (V.O.)
Was 2-for-1, so I got one for you. No offense, but I have no one else to give it to.

MARCUS'S VOICE (V.O.)
(laughing)
Asshole.

BACK TO PRESENT:

Kael's grip tightens on his sidearm.

One of the figures turns, catches movement in the doorway.

FIGURE 1
Hey--

He fumbles for his weapon.

Kael MOVES.

INT. MARCUS'S APARTMENT - CONTINUOUS

GUNFIRE. Wild. Figure 1's first shots go wide, punching holes in the ceiling.

Kael dives behind the remains of a collapsed couch.

Figure 2 opens fire--spraying rounds without aiming. The couch shreds. Kael stays low.

He returns fire. Two shots. Figure 2 staggers, clutching his arm.

FIGURE 2
Shit! SHIT!

Kael vaults the couch, sprinting toward the shelf. His hand reaches for the case--

A shot splinters the shelf inches from his fingers. He ducks back behind a scorched cabinet.

Waits. Breathing.

He grabs a chunk of debris, hurls it across the room. It clatters against the far wall.

Both figures turn toward the sound.

Kael moves--one fluid motion. Grabs the case, pockets it, keeps running.

FIGURE 1
He grabbed something!

Kael spins. The bathroom--what's left of it--has a VENT ACCESS near the ceiling. He's already moving.

He LEAPS, catches the edge of the vent, PULLS himself up as gunfire SHREDS the wall below him.

INT. MARCUS'S BUILDING - VENTILATION SHAFT - CONTINUOUS

Kael crawls. Fast. The space is tight--barely wide enough for his shoulders. The metal groans under his weight.

Behind him, shouting. Confusion.

FIGURE 1 (O.S.)
(muffled)
Where'd he go?

Kael reaches a junction. Chooses left. Crawls faster.

The shaft ENDS at another vent cover. He can see through the slats--a HALLWAY. Different floor. Maybe second.

He KICKS the cover out. Drops through.

INT. MARCUS'S BUILDING - SECOND FLOOR HALLWAY - CONTINUOUS

Kael lands hard, rolls, comes up running.

The hallway is residential--doors on both sides. A few are OPEN, residents peering out at the noise. An OLD MAN in a bathrobe. A YOUNG WOMAN with a child on her hip.

KAEL
(as he runs)
Get inside. Lock your doors.

They stare. He's gone before they can respond.

STAIRWELL. He hits the door, takes the stairs up.

INT. MARCUS'S BUILDING - STAIRWELL - CONTINUOUS

Kael climbs. His legs burn but they don't fail him.

BELOW: boots on metal. Shouting.

FIGURE 2 (O.S.)
He's going up!

FIGURE 1 (O.S.)
Go, go!

Kael reaches the FOURTH FLOOR door. Opens it. Closes it loudly.

But doesn't go through. He waits.

FOOTSTEPS pound past, going up.

He slips back into the stairwell. Goes DOWN.

INT. MARCUS'S BUILDING - FIRST FLOOR - CONTINUOUS

Kael emerges into a service corridor. Basement access, utility rooms, a back exit.

He takes the EXIT.

EXT. MARCUS'S BUILDING - ALLEY - CONTINUOUS

The alley is narrow, dark, lined with refuse processors and recycling units. The smell is overwhelming.

Kael moves fast but not running. Walks with purpose, keeping to shadows.

He reaches the street. Turns right. Away from the building.

SIRENS begin in the distance. Getting closer.

He walks faster.

EXT. NEW FRANCISCO - TENDERLOIN DISTRICT - SIDE STREETS - CONTINUOUS

Kael navigates the maze of side streets. Taking turns at random. Putting distance between himself and the scene.

The streets are emptier here--late night, residential, working-class neighborhood asleep or pretending to be. The occasional drone passes overhead. He avoids their lights.

He stops. Listens. Nothing. No boots. No pursuit.

He exhales. Pulls his HEADPHONES back on. The HUM returns. His shoulders drop slightly.

KAEL
(quiet)
Marcus, what did you get yourself into?

He keeps moving. Faster now.

A CORNER. He turns it, looking back over his shoulder--

He doesn't hear her footsteps. The headphones. The brown noise.

COLLISION.

His shoulder CONNECTS with someone's face. Hard.

A WOMAN. She goes DOWN, hitting the pavement. Doesn't get up.

Kael stumbles, catches himself.

He takes three steps.

Stops.

Looks back.

She's on the ground. Not moving. The streetlight here is flickering, half-dead.

Kael pulls off his headphones. The world comes rushing back--sirens, still distant. No immediate pursuit.

He goes back.

She's BREATHING. Just knocked out. Her face is turned away, hair covering her features.

He grabs her under the arms. DRAGS her toward a doorway--an alcove, recessed, dark.

KAEL
(muttering)
Come on...

He props her against the wall. She slumps but stays sitting. Still unconscious.

His hands check her for injuries. No blood. No obvious breaks. Just knocked cold.

He pulls out his phone. Activates the light.

And FREEZES.

CLOSE ON: ELARA OYELARAN'S FACE

The same face as Marcus. Feminine. Softer. But the bone structure is identical. The eyes--closed now--are the same shape, the same set.

FLASHBACK - QUICK:

NEWS HEADLINE (V.O.)
"...Twin sister survived..."

BACK TO PRESENT:

KAEL
(barely a whisper)
Elara.

SIRENS. Closer now. Much closer.

Kael looks up. Through the alcove opening, he can see the street beginning to FILL.

Vehicles roll past--unmarked SUVs, a van with a faded agency logo. Men climb out in mismatched gear, some in vests, some not. Holstered pistols, a few shotguns. They spread out like they're following a script none of them memorized.

EXT. NEW FRANCISCO - TENDERLOIN DISTRICT - STREET - CONTINUOUS

The crackdown begins.

The men fan out, pounding on doors, shouting. Residents dragged into the street.

An OLD MAN protests. He's STRUCK with a baton, forced to his knees.

A FAMILY emerges, hands raised. CHILDREN CRYING. They're pushed against a wall and questioned.

DRONES flood the airspace, spotlights sweeping the streets.

Shouts. Screams. The sounds of a neighborhood being torn apart.

INT. ALCOVE - CONTINUOUS

Kael watches through a gap in the doorway.

ELARA stirs.

Kael turns. She's coming to. Her eyes flutter, trying to focus. Her hand goes to her head--pain.

ELARA
(groggy)
Wh... what...

Her eyes find Kael. A stranger crouched over her in the dark.

She starts to panic.

Outside: SIRENS. BOOTS. SCREAMING. The crackdown tearing the neighborhood apart.

She opens her mouth to scream--

SMASH CUT TO BLACK.

SILENCE.

Hold on black for a long beat.

Then -- distant, muffled -- the sounds of the crackdown continuing. Sirens. Shouts. A child crying somewhere.

The sounds fade.

TITLE CARD:

T E T H E R

The title holds. Then fades.

BLACK.

FADE OUT.


END OF EPISODE 1`);
  const [isProcessingScript, setIsProcessingScript] = useState(false);
  const [scriptStartTime, setScriptStartTime] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"references" | "sequences" | "data" | "settings">("sequences");
  const [masterChars, setMasterChars] = useState<Record<string, Character>>({
    "kael": {
      "name": "Kael Vasaro",
      "prompt": "A weathered man in his 50s, grey stubble, deep-set weary eyes, wearing a patched flight suit with faded insignias. Cybernetic data port visible behind his left ear."
    },
    "tomas": {
      "name": "Tomas",
      "prompt": "A burly station mechanic in greasy coveralls, with a thick beard and a suspicious expression."
    },
    "yuki": {
      "name": "Yuki",
      "prompt": "A lean, sharp-eyed mechanic with short-cropped black hair and a tool belt slung low on her hips."
    },
    "marcus": {
      "name": "Marcus",
      "prompt": "A shadowy figure in a hooded cloak, his face partially obscured by shadows."
    },
    "fake_cops": {
      "name": "Security Guards",
      "prompt": "Figures in black security uniforms with polarized visors that obscure their faces."
    },
    "elara": {
      "name": "Elara (AI)",
      "prompt": "A shimmering blue AI avatar with ethereal features and glowing eyes."
    }
  });
  const [masterProps, setMasterProps] = useState<Record<string, Prop>>({
    liminal: {
      name: "The Liminal (Ship)",
      prompt: "A rugged, modular spaceship with a weathered hull, exposed cable runs, and a distinctive nose shape. It looks like it's been through decades of repairs."
    },
    kepler: {
      name: "Kepler Station",
      prompt: "A massive, skeletal space station with industrial modules, docking arms, and rotating warning lights, set against a gas giant."
    },
    docking_clamps: {
      name: "Docking Clamps",
      prompt: "Massive hydraulic metal clamps with heavy pistons and industrial grime, designed to lock onto ship hulls."
    },
    data_cube: {
      name: "Data Cube",
      prompt: "A small, glowing crystalline cube with intricate internal circuitry that emits a soft blue light."
    }
  });
  const [sharedProps, setSharedProps] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  const [activeTabs, setActiveTabs] = useState<Record<number, GenerationMode>>({});
  const [scriptText, setScriptText] = useState("");
  const [streamingScriptText, setStreamingScriptText] = useState("");
  const [showScriptEditor, setShowScriptEditor] = useState(false);

  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
    prompt?: string;
    feedback?: string;
    settings?: any;
  }>({
    isOpen: false,
    imageUrl: "",
    title: "",
  });

  const [results, setResults] = useState<Record<number, {
    story1K: GenerationResult | null;
    story2K: GenerationResult | null;
    story1K_layout: GenerationResult | null;
    story2K_layout: GenerationResult | null;
    loadingMode: string | null;
    status: string;
    startTime?: number;
  }>>({});
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback for local development or if not in AI Studio
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition
      setHasApiKey(true);
    }
  };

  // Shared references across sequences with persistence
  const [sharedLocs, setSharedLocs] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  const [sharedChars, setSharedChars] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  
  const [toast, setToast] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');

  // Persistence Load (Async IndexedDB)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locs, chars, props, savedResults, savedStoryboard, savedSummaries] = await Promise.all([
          get('tether_locs'),
          get('tether_chars'),
          get('tether_props'),
          get('tether_results'),
          get('tether_storyboard'),
          get('tether_summaries')
        ]);
        
        if (locs) {
          const cleaned = { ...locs };
          Object.keys(cleaned).forEach(k => cleaned[k].loading = false);
          setSharedLocs(cleaned);
        }
        if (chars) {
          const cleaned = { ...chars };
          Object.keys(cleaned).forEach(k => cleaned[k].loading = false);
          setSharedChars(cleaned);
        }
        if (props) {
          const cleaned = { ...props };
          Object.keys(cleaned).forEach(k => cleaned[k].loading = false);
          setSharedProps(cleaned);
        }
        if (savedStoryboard) setStoryboard(savedStoryboard);
        if (savedSummaries) setSequenceSummaries(savedSummaries);
        
        const initialResults: any = {};
        
        // Use saved storyboard if available, otherwise use default
        const currentStoryboard = savedStoryboard || DEFAULT_STORYBOARD;
        
        currentStoryboard.forEach((p: any) => {
          const saved = savedResults?.[p.id];
          initialResults[p.id] = saved ? { ...saved, loadingMode: null, status: '' } : { 
            story1K: null, 
            story2K: null, 
            story1K_layout: null, 
            story2K_layout: null, 
            loadingMode: null, 
            status: '' 
          };
        });
        setResults(initialResults);
        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load from IndexedDB", err);
        setIsLoaded(true);
      }
    };
    loadData();
  }, []); // Run ONCE on mount

  // Persistence Sync (Async IndexedDB)
  useEffect(() => {
    if (isLoaded) {
      // Filter out loading states before saving
      const cleanLocs = { ...sharedLocs };
      Object.keys(cleanLocs).forEach(k => cleanLocs[k] = { ...cleanLocs[k], loading: false });
      
      const cleanChars = { ...sharedChars };
      Object.keys(cleanChars).forEach(k => cleanChars[k] = { ...cleanChars[k], loading: false });
      
      const cleanProps = { ...sharedProps };
      Object.keys(cleanProps).forEach(k => cleanProps[k] = { ...cleanProps[k], loading: false });

      set('tether_locs', cleanLocs);
      set('tether_chars', cleanChars);
      set('tether_props', cleanProps);
      set('tether_storyboard', storyboard);
      set('tether_summaries', sequenceSummaries);
      
      const resultsToSave = { ...results };
      Object.keys(resultsToSave).forEach(key => {
        resultsToSave[key] = { ...resultsToSave[key], loadingMode: null, status: '' };
      });
      set('tether_results', resultsToSave);
    }
  }, [sharedLocs, sharedChars, sharedProps, storyboard, sequenceSummaries, results, isLoaded]);

  const clearPersistence = async () => {
    await clear();
    window.location.reload();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleScriptOverride = () => {
    try {
      const parsed = JSON.parse(scriptText);
      setStoryboard(parsed);
      setShowScriptEditor(false);
      showToast("Script Updated Successfully");
    } catch (e) {
      alert("Invalid JSON script format");
    }
  };

  const generateLocation = async (locPrompt: string, size: "512px" | "1K" | "2K" = "1K", force = false) => {
    const sizeOrder: Record<string, number> = { "512px": 0, "1K": 1, "2K": 2, "4K": 3 };
    // Cache check: Don't overwrite higher quality with lower quality
    const existing = sharedLocs[locPrompt];
    if (!force && existing?.result) {
      const existingSize = existing.result.settings.size as string;
      if (sizeOrder[existingSize] >= sizeOrder[size]) return existing.result;
    }

    setSharedLocs(prev => ({ ...prev, [locPrompt]: { result: prev[locPrompt]?.result || null, loading: true, startTime: Date.now() } }));
    try {
      const res = await generateProductionAsset(
        `[CONTEXT]: Reference Location (EMPTY ENVIRONMENT, NO PEOPLE, NO CHARACTERS, NO FOREGROUND CHARACTERS): ${locPrompt}. 
[STYLE]: ${GLOBAL_STYLE}`, 
        [], 
        size, 
        undefined, 
        selectedModel,
        "16:9",
        {
          imagePrompt: locPrompt,
          stylePrompt: GLOBAL_STYLE,
          contextPrompt: "EMPTY ENVIRONMENT, NO PEOPLE, NO CHARACTERS, NO FOREGROUND CHARACTERS"
        }
      );
      setSharedLocs(prev => ({ ...prev, [locPrompt]: { result: res, loading: false } }));
      return res;
    } catch (err: any) {
      setSharedLocs(prev => ({ ...prev, [locPrompt]: { result: prev[locPrompt]?.result || null, loading: false } }));
      const isOverloaded = JSON.stringify(err).includes("503") || JSON.stringify(err).includes("500");
      showToast(isOverloaded ? "Engine Overloaded. Try switching models." : "Location Generation Failed.");
      throw err;
    }
  };

  const generateCharacter = async (charId: string, size: "512px" | "1K" | "2K" = "1K", force = false) => {
    const charObj = masterChars[charId] || { name: charId, prompt: charId };
    const sizeOrder: Record<string, number> = { "512px": 0, "1K": 1, "2K": 2, "4K": 3 };
    
    // Cache check: Don't overwrite higher quality with lower quality
    const existing = sharedChars[charId];
    if (!force && existing?.result) {
      const existingSize = existing.result.settings.size as string;
      if (sizeOrder[existingSize] >= sizeOrder[size]) return existing.result;
    }

    setSharedChars(prev => ({ ...prev, [charId]: { result: prev[charId]?.result || null, loading: true, startTime: Date.now() } }));
    try {
      const res = await generateProductionAsset(
        `[CONTEXT]: Reference Character Portrait: ${charObj.prompt}. 
[STYLE]: ${GLOBAL_STYLE}`, 
        [], 
        size, 
        undefined, 
        selectedModel,
        "3:4",
        {
          imagePrompt: charObj.prompt,
          stylePrompt: GLOBAL_STYLE,
          contextPrompt: `Reference Character Portrait: ${charObj.name}`
        }
      );
      setSharedChars(prev => ({ ...prev, [charId]: { result: res, loading: false } }));
      return res;
    } catch (err: any) {
      setSharedChars(prev => ({ ...prev, [charId]: { result: prev[charId]?.result || null, loading: false } }));
      const isOverloaded = JSON.stringify(err).includes("503") || JSON.stringify(err).includes("500");
      showToast(isOverloaded ? "Engine Overloaded. Try switching models." : "Character Generation Failed.");
      throw err;
    }
  };

  const processScript = async () => {
    if (!rawScript.trim()) return;
    setIsProcessingScript(true);
    setScriptStartTime(Date.now());
    setStreamingScriptText("");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
      const currentContext = {
        masterChars,
        masterProps,
        storyboard,
        sequenceSummaries
      };

      const prompt = SCRIPT_INGEST_PROMPT_TEMPLATE
        .replace("{{CURRENT_CONTEXT}}", JSON.stringify(currentContext, null, 2))
        .replace("{{RAW_SCRIPT}}", rawScript);

      const response = await ai.models.generateContentStream({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let fullText = "";
      for await (const chunk of response) {
        fullText += chunk.text;
        setStreamingScriptText(fullText);
      }

      const data = JSON.parse(fullText || "{}");
      if (data.masterChars) setMasterChars(data.masterChars);
      if (data.masterProps) setMasterProps(data.masterProps);
      if (data.sequenceSummaries) setSequenceSummaries(data.sequenceSummaries);
      if (data.storyboard) {
        setStoryboard(data.storyboard);
        setScriptText(JSON.stringify(data, null, 2));
      }
      showToast("Script Merged Successfully.");
      setShowScriptEditor(false);
    } catch (err) {
      console.error("Script Processing Error:", err);
      showToast("Failed to process script.");
    } finally {
      setIsProcessingScript(false);
      setScriptStartTime(null);
      setStreamingScriptText("");
    }
  };

  const generateProp = async (propId: string, size: "1K" | "2K" = "1K", force = false) => {
    const prop = masterProps[propId];
    if (!prop) return;
    setSharedProps(prev => ({ ...prev, [propId]: { result: prev[propId]?.result || null, loading: true, startTime: Date.now() } }));
    
    try {
      const result = await generateProductionAsset(
        prop.prompt,
        [],
        size,
        undefined,
        selectedModel,
        "1:1",
        {
          imagePrompt: prop.prompt,
          stylePrompt: GLOBAL_STYLE,
          contextPrompt: `Master Prop Reference: ${prop.name}. High-fidelity object study.`
        }
      );
      setSharedProps(prev => ({ ...prev, [propId]: { result, loading: false } }));
      showToast(`Prop ${prop.name} generated!`);
    } catch (err) {
      setSharedProps(prev => ({ ...prev, [propId]: { result: prev[propId]?.result || null, loading: false } }));
      showToast("Prop generation failed.");
    }
  };

  const getStalenessReason = (page: PageData, result: GenerationResult | null): string | null => {
    if (!result || !result.referenceSnapshot) return null;
    const snap = result.referenceSnapshot;
    
    if (page.loc.prompt !== snap.locPrompt) return "Location prompt changed";
    if (sharedLocs[page.loc.prompt]?.result?.image !== snap.locImage) return "Location reference image updated";
    
    for (const cid of page.chars) {
      if (!snap.charPrompts[cid] || masterChars[cid]?.prompt !== snap.charPrompts[cid]) return `Character '${masterChars[cid]?.name || cid}' prompt changed`;
      if (sharedChars[cid]?.result?.image !== snap.charImages[cid]) return `Character '${masterChars[cid]?.name || cid}' reference image updated`;
    }
    
    if (JSON.stringify(page.frames || []) !== JSON.stringify(snap.frames || [])) return "Script frames modified";
    
    return null;
  };

  const getPromptData = (page: PageData, mode: GenerationMode) => {
    const locPrompt = page.loc.prompt;
    const pageFrames = page.frames || [];
    const isFull = mode.startsWith("full");
    const frames = isFull ? pageFrames : pageFrames.filter(f => f.priority === "highlight");
    const framesToUse = frames.length > 0 ? frames : pageFrames.slice(0, 4);
    
    const count = framesToUse.length;
    // To maintain the same aspect ratio as the parent, we want cols == rows.
    // This ensures (W/cols) / (H/rows) == W/H.
    let cols = Math.ceil(Math.sqrt(count));
    let rows = cols; 
    const gridLayout = `${cols}x${rows}`;
    
    const charNames = page.chars.map(cid => masterChars[cid]?.name || cid).join(', ');
    const propNames = (page.props || []).map(pid => masterProps[pid]?.name || pid).join(', ');

    let composite = `[CONTEXT]: Cinematic storyboard grid (${gridLayout} sequence, ${count} frames). Location: ${locPrompt}. Characters: ${charNames}. Props: ${propNames}.
[STYLE]: ${GLOBAL_STYLE} ${SUBTITLE_STYLE}.
[CONTINUITY]: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly. 
[LAYOUT]: CRITICAL: Use the provided layout reference image as a spatial guide for composition. Match the framing and object placement exactly.
[KEYFRAMES]: `;
    let imagePrompt = "";
    let contextPrompt = `Cinematic storyboard grid (${gridLayout} sequence, ${count} frames). Location: ${locPrompt}. Characters: ${charNames}. Props: ${propNames}. `;
    
    // Continuity Instructions
    const continuity = "CRITICAL: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly. ";
    composite += continuity;
    contextPrompt += continuity;

    if (isFull) {
      const motionStudy = `Full Production Track (Temporal): ${count}-frame granular sequence showing fluid motion and micro-transitions. 
      CRITICAL: This MUST be a ${gridLayout} grid containing ${count} distinct frames. 
      Each frame represents a tiny slice of time, showing the scene in motion. `;
      composite += motionStudy;
      imagePrompt += motionStudy;
    } else {
      const highlightTrack = `Highlight Track (Main Points): Simple ${gridLayout} grid showing ${count} key highlight frames. `;
      composite += highlightTrack;
      imagePrompt += highlightTrack;
    }
    
    framesToUse.forEach((f, i) => { 
      const frameText = `[Frame ${i+1}]: ${f.prompt} `;
      composite += frameText;
      imagePrompt += frameText;
    });

    return { composite, imagePrompt, contextPrompt };
  };

  const runProductionCycle = async (pageId: number) => {
    const mode = "full_layout" as GenerationMode;
    const page = storyboard.find(p => p.id === pageId);
    if (!page) return;

    const locPrompt = page.loc.prompt;
    
    // Generate layout on the fly
    const layoutRef = generateScriptLayout(page.frames || [], "full", storyboardAspectRatio);
    
    setResults(prev => ({
      ...prev,
      [pageId]: { ...prev[pageId], loadingMode: mode, status: `🎬 SYNCING REFERENCES FOR ${mode}...`, startTime: Date.now() }
    }));

    try {
      const [locRes, ...charAndPropResults] = await Promise.all([
        sharedLocs[locPrompt]?.result ? Promise.resolve(sharedLocs[locPrompt].result) : generateLocation(locPrompt),
        ...page.chars.map(cid => sharedChars[cid]?.result ? Promise.resolve(sharedChars[cid].result) : generateCharacter(cid)),
        ...(page.props || []).map(pid => sharedProps[pid]?.result ? Promise.resolve(sharedProps[pid].result) : generateProp(pid, "1K"))
      ]);

      const charResults = charAndPropResults.slice(0, page.chars.length);
      const propResults = charAndPropResults.slice(page.chars.length);

      setResults(prev => ({ ...prev, [pageId]: { ...prev[pageId], status: `🎬 GENERATING ${mode} TRACK...` } }));
      
      let { composite, imagePrompt, contextPrompt } = getPromptData(page, mode);
      const isFull = mode.startsWith("full");
      
      console.log("Final Prompt:", composite);
      
      const referenceImages = [];
      if (locRes?.image) referenceImages.push(locRes.image);
      charResults.forEach(cr => {
        if (cr?.image) referenceImages.push(cr.image);
      });
      propResults.forEach(pr => {
        if (pr?.image) referenceImages.push(pr.image);
      });

      // --- CONTINUITY: PREVIOUS BATCH REFERENCES ---
      
      // 1. Previous Sequence (Temporal Continuity)
      const prevPage = storyboard.find(p => p.id === pageId - 1);
      if (prevPage) {
        const prevRes = results[prevPage.id];
        const prevBatchImage = prevRes?.story2K?.image || prevRes?.story1K?.image || prevRes?.story2K_layout?.image || prevRes?.story1K_layout?.image;
        if (prevBatchImage) {
          referenceImages.push(prevBatchImage);
          const temporalText = "Reference image includes the PREVIOUS SEQUENCE for temporal continuity. ";
          composite += temporalText;
          contextPrompt += temporalText;
        }
      }

      // 2. Previous Iteration of this Tab (Iterative Continuity)
      const resultKey = mode === "highlights" ? "story1K" : 
                        mode === "full" ? "story2K" : 
                        mode === "highlights_layout" ? "story1K_layout" : "story2K_layout";
      const lastIterationImage = results[pageId][resultKey]?.image;
      if (lastIterationImage) {
        referenceImages.push(lastIterationImage);
        const iterativeText = "Reference image includes the PREVIOUS ITERATION of this specific track. Maintain and refine this look. ";
        composite += iterativeText;
        contextPrompt += iterativeText;
      }

      // 3. Cross-Mode Continuity (highlights <-> full)
      const otherModeKey = isFull ? "story1K" : "story2K";
      const otherModeImage = results[pageId][otherModeKey]?.image;
      if (otherModeImage) {
        referenceImages.push(otherModeImage);
        const crossModeText = `Reference image includes the ${isFull ? "Highlights" : "Full"} version of this sequence. Maintain visual consistency with this existing track. `;
        composite += crossModeText;
        contextPrompt += crossModeText;
      }

      const resStory = await generateProductionAsset(
        composite, 
        referenceImages, 
        isFull ? "2K" : "1K", 
        layoutRef, 
        selectedModel,
        storyboardAspectRatio,
        {
          imagePrompt,
          stylePrompt: `${GLOBAL_STYLE} ${SUBTITLE_STYLE}`,
          contextPrompt
        }
      );

      // Capture reference snapshot
      const charPrompts: Record<string, string> = {};
      const charImages: Record<string, string> = {};
      page.chars.forEach(cid => {
        charPrompts[cid] = masterChars[cid]?.prompt || cid;
        charImages[cid] = sharedChars[cid]?.result?.image || '';
      });

      const referenceSnapshot = {
        locPrompt: page.loc.prompt,
        locImage: locRes?.image,
        charPrompts,
        charImages,
        frames: JSON.parse(JSON.stringify(page.frames || []))
      };
      
      setResults(prev => ({
        ...prev,
        [pageId]: { 
          ...prev[pageId], 
          [resultKey]: { ...resStory, referenceSnapshot }, 
          loadingMode: null, 
          status: "Production Cycle Complete." 
        }
      }));
      
      setActiveTabs(prev => ({ ...prev, [pageId]: mode }));
      showToast(`${mode} Track Complete.`);
    } catch (err: any) {
      const errStr = JSON.stringify(err);
      const is503 = errStr.includes("503");
      const is500 = errStr.includes("500");
      
      let statusMsg = "❌ PIPELINE FAILED.";
      if (is503) statusMsg = "❌ MODEL OVERLOADED (503). Try Nano Banana (2.5).";
      if (is500) statusMsg = "❌ INTERNAL ENGINE ERROR (500). Try again or switch models.";
      
      setResults(prev => ({
        ...prev,
        [pageId]: { ...prev[pageId], loadingMode: null, status: statusMsg }
      }));
      
      if (is503 || is500) {
        showToast(is503 ? "Gemini 3.1 is busy (503)." : "Internal Engine Error (500).");
      }
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto border border-sky-500/30">
            <Key className="text-sky-400" size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight mb-2">API Key Required</h2>
            <p className="text-sm text-slate-400">
              This application uses advanced Gemini models that require a user-provided API key from a paid Google Cloud project.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Select API Key
          </button>
          <p className="text-xs text-slate-500">
            Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">billing and API keys</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <p className="text-slate-400 text-sm uppercase tracking-widest font-black italic">TETHER <span className="text-sky-600 font-bold ml-2">— Multimodal Production Engine</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900/50 border border-slate-700/50 rounded-full px-4 py-2 gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Model Engine</span>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-xs font-bold text-sky-400 outline-none cursor-pointer"
            >
              <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (3.1)</option>
              <option value="gemini-2.5-flash-image">Nano Banana (2.5)</option>
            </select>
          </div>
          <button 
            onClick={clearPersistence}
            className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-6 py-3 rounded-full font-black text-xs uppercase transition-all border border-red-900/30 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Clear
          </button>
          <button 
            onClick={() => setShowScriptEditor(!showScriptEditor)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-full font-black text-xs uppercase transition-all border border-slate-700 flex items-center gap-2"
          >
            <FileText size={14} />
            Script Ingest
          </button>
        </div>
      </header>

      {showScriptEditor || storyboard.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-sky-500/10 rounded-2xl">
              <FileText className="text-sky-400" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white italic">SCRIPT INGESTION</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Paste your raw script to generate a production bible</p>
            </div>
          </div>
          
          <textarea 
            value={rawScript}
            onChange={(e) => setRawScript(e.target.value)}
            placeholder="Paste your script here... (e.g. INT. COCKPIT - NIGHT. The pilot stares into the void...)"
            className="w-full h-96 bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-300 font-mono text-sm outline-none focus:border-sky-500/50 transition-all mb-8"
          />

          <div className="flex justify-end gap-4 items-center">
            {isProcessingScript && scriptStartTime && (
              <span className="text-sky-500/50 text-[10px] font-mono uppercase tracking-widest">
                ELAPSED: {Math.floor((currentTime - scriptStartTime) / 1000)}s
              </span>
            )}
            {storyboard.length > 0 && (
              <button 
                onClick={() => setShowScriptEditor(false)}
                className="px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-400 hover:text-white transition-all"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={processScript}
              disabled={isProcessingScript || !rawScript.trim()}
              className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3"
            >
              {isProcessingScript ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              {isProcessingScript ? "Processing Script..." : "Generate Production Bible"}
            </button>
          </div>

          {isProcessingScript && streamingScriptText && (
            <div className="mt-8 p-6 bg-slate-950 border border-slate-800 rounded-2xl max-h-64 overflow-y-auto">
              <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Live Analysis Output</p>
              <pre className="text-slate-500 font-mono text-[10px] whitespace-pre-wrap">{streamingScriptText}</pre>
            </div>
          )}
        </motion.div>
      ) : (
        <>
          <nav className="flex items-center gap-8 mb-6 border-b border-slate-800/50 pb-2">
            <button 
              onClick={() => setActivePanel("sequences")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "sequences" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Sequences
              {activePanel === "sequences" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
            <button 
              onClick={() => setActivePanel("references")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "references" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              References
              {activePanel === "references" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
            <button 
              onClick={() => setActivePanel("data")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "data" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Data
              {activePanel === "data" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
            <button 
              onClick={() => setActivePanel("settings")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "settings" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Settings
              {activePanel === "settings" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
          </nav>

      <main className="space-y-8">
        {activePanel === "references" ? (
          <div className="space-y-8">
            {/* References Header */}
            <section className="bg-sky-500/5 border border-sky-500/10 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-3">
                <Zap className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Visual Anchor System</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-3xl">
                The Tether pipeline relies on <span className="text-sky-400 font-bold italic">Visual Anchors</span> to maintain cinematic consistency. 
                Generate your <span className="text-sky-400 font-bold">Location</span> and <span className="text-purple-400 font-bold">Character</span> master references first. 
                These assets are injected into the generation prompt for every story beat, ensuring that lighting, architecture, and character features remain identical across the entire production.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-6">
                <Camera className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic">LOCATION MASTER LIST</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Array.from(new Set(storyboard.map(p => p.loc.prompt))) as string[]).map(locPrompt => (
                  <ReferenceCard 
                    key={locPrompt}
                    title={locPrompt}
                    type="Location"
                    aspectRatio="aspect-video"
                    data={sharedLocs[locPrompt]}
                    onGenerate={() => { generateLocation(locPrompt, "1K", true); }}
                    onImageClick={(url, title, prompt, feedback, settings) => setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-6">
                <User className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic">CHARACTER MASTER LIST</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {Object.keys(masterChars).map(charId => (
                  <ReferenceCard 
                    key={charId}
                    title={masterChars[charId].name}
                    type="Character"
                    aspectRatio="aspect-[3/4]"
                    data={sharedChars[charId]}
                    onGenerate={() => { generateCharacter(charId, "1K", true); }}
                    onImageClick={(url, title, prompt, feedback, settings) => setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </section>
            <section>
              <div className="flex items-center gap-4 mb-6">
                <Box className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic">PROP MASTER LIST</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {Object.keys(masterProps).map(propId => (
                  <ReferenceCard 
                    key={propId}
                    title={masterProps[propId].name}
                    type="Prop"
                    aspectRatio="aspect-square"
                    data={sharedProps[propId]}
                    onGenerate={() => { generateProp(propId, "1K", true); }}
                    onImageClick={(url, title, prompt, feedback, settings) => setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : activePanel === "data" ? (
          <div className="space-y-8">
            {/* Script Ingest */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Script Ingest</h3>
              <textarea 
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                placeholder="Paste your script here..."
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-300 font-mono text-sm outline-none focus:border-sky-500/50 transition-all mb-4"
              />
              <div className="flex justify-end gap-4 items-center">
                {isProcessingScript && scriptStartTime && (
                  <span className="text-sky-500/50 text-[10px] font-mono uppercase tracking-widest">
                    ELAPSED: {Math.floor((currentTime - scriptStartTime) / 1000)}s
                  </span>
                )}
                <button 
                  onClick={processScript}
                  disabled={isProcessingScript || !rawScript.trim()}
                  className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  {isProcessingScript ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                  {isProcessingScript ? "Processing..." : "Generate Production Bible"}
                </button>
              </div>
              {isProcessingScript && streamingScriptText && (
                <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Live Analysis Output</p>
                  <pre className="text-slate-500 font-mono text-[10px] whitespace-pre-wrap">{streamingScriptText}</pre>
                </div>
              )}
            </section>

            {/* Script Ingest Prompt */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Ingest Prompt Template</h3>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap">
                {SCRIPT_INGEST_PROMPT_TEMPLATE}
              </pre>
            </section>

            {/* JSON Viewer */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-black uppercase tracking-widest italic">Production Bible JSON</h3>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify({ masterChars, storyboard, sequenceSummaries }, null, 2));
                    showToast("JSON Copied to Clipboard");
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-sky-400/80 overflow-auto max-h-64 whitespace-pre-wrap">
                {JSON.stringify({ masterChars, storyboard, sequenceSummaries }, null, 2)}
              </pre>
            </section>

            {/* References Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-black uppercase tracking-widest italic mb-4">References Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Type</th>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Name/Title</th>
                      <th className="px-4 py-3">Prompt</th>
                      <th className="px-4 py-3 rounded-tr-lg">Image</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Characters */}
                    {Object.keys(masterChars).map((id) => {
                      const char = masterChars[id];
                      return (
                      <tr key={`char-${id}`} className="border-b border-slate-800/50">
                        <td className="px-4 py-3">Character</td>
                        <td className="px-4 py-3 font-mono text-xs">{id}</td>
                        <td className="px-4 py-3 font-bold text-slate-300">{char.name}</td>
                        <td className="px-4 py-3 text-xs">{char.prompt}</td>
                        <td className="px-4 py-3">
                          {sharedChars[id]?.result?.image ? (
                            <img src={sharedChars[id].result.image} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : <span className="text-xs text-slate-600">None</span>}
                        </td>
                      </tr>
                    )})}
                    {/* Props */}
                    {Object.keys(masterProps).map((id) => {
                      const prop = masterProps[id];
                      return (
                      <tr key={`prop-${id}`} className="border-b border-slate-800/50">
                        <td className="px-4 py-3">Prop</td>
                        <td className="px-4 py-3 font-mono text-xs">{id}</td>
                        <td className="px-4 py-3 font-bold text-slate-300">{prop.name}</td>
                        <td className="px-4 py-3 text-xs">{prop.prompt}</td>
                        <td className="px-4 py-3">
                          {sharedProps[id]?.result?.image ? (
                            <img src={sharedProps[id].result.image} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : <span className="text-xs text-slate-600">None</span>}
                        </td>
                      </tr>
                    )})}
                    {/* Locations */}
                    {Array.from(new Set(storyboard.map(p => p.loc.prompt))).map(locPrompt => {
                      const locTitle = storyboard.find(p => p.loc.prompt === locPrompt)?.loc.title || "Unknown";
                      return (
                        <tr key={`loc-${locPrompt}`} className="border-b border-slate-800/50">
                          <td className="px-4 py-3">Location</td>
                          <td className="px-4 py-3 font-mono text-xs">-</td>
                          <td className="px-4 py-3 font-bold text-slate-300">{locTitle}</td>
                          <td className="px-4 py-3 text-xs">{locPrompt}</td>
                          <td className="px-4 py-3">
                            {sharedLocs[locPrompt]?.result?.image ? (
                              <img src={sharedLocs[locPrompt].result.image} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                            ) : <span className="text-xs text-slate-600">None</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Storyboard Images Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Storyboard Images Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Beat ID</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Sequence</th>
                      <th className="px-4 py-3">1K Image</th>
                      <th className="px-4 py-3">2K Image</th>
                      <th className="px-4 py-3">1K Layout</th>
                      <th className="px-4 py-3 rounded-tr-lg">2K Layout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storyboard.map(page => (
                      <tr key={`sb-${page.id}`} className="border-b border-slate-800/50">
                        <td className="px-4 py-3 font-mono text-xs">{page.id}</td>
                        <td className="px-4 py-3 font-bold text-slate-300">{page.title}</td>
                        <td className="px-4 py-3 text-xs">{page.sequence}</td>
                        <td className="px-4 py-3">
                          {results[page.id]?.story1K?.image ? (
                            <img src={results[page.id].story1K.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : <span className="text-xs text-slate-600">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          {results[page.id]?.story2K?.image ? (
                            <img src={results[page.id].story2K.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : <span className="text-xs text-slate-600">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          {results[page.id]?.story1K_layout?.image ? (
                            <img src={results[page.id].story1K_layout.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : <span className="text-xs text-slate-600">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          {results[page.id]?.story2K_layout?.image ? (
                            <img src={results[page.id].story2K_layout.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : <span className="text-xs text-slate-600">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Sequence Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Sequence Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Sequence Name</th>
                      <th className="px-4 py-3">Summary</th>
                      <th className="px-4 py-3 rounded-tr-lg">Beats Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(sequenceSummaries).map(([seqName, summary]) => (
                      <tr key={`seq-${seqName}`} className="border-b border-slate-800/50">
                        <td className="px-4 py-3 font-bold text-slate-300 whitespace-nowrap">{seqName}</td>
                        <td className="px-4 py-3 text-xs">{summary}</td>
                        <td className="px-4 py-3 font-mono text-xs">{storyboard.filter(p => p.sequence === seqName).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Keyframes Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Keyframes Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Beat ID</th>
                      <th className="px-4 py-3">Frame ID</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3 rounded-tr-lg">Prompt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storyboard.flatMap(page => 
                      page.frames.map(frame => (
                        <tr key={`frame-${page.id}-${frame.id}`} className="border-b border-slate-800/50">
                          <td className="px-4 py-3 font-mono text-xs">{page.id}</td>
                          <td className="px-4 py-3 font-mono text-xs">{frame.id}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              frame.priority === 'highlight' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {frame.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">{frame.prompt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : activePanel === "settings" ? (
          <div className="space-y-8">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <Settings className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Settings</h2>
              </div>
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">API Key Configuration</label>
                  <p className="text-sm text-slate-500 mb-4">
                    The application requires a valid Gemini API key to function. You can update your selected key here.
                  </p>
                  <button
                    onClick={handleSelectKey}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-2 text-sm"
                  >
                    <Key size={16} />
                    {hasApiKey ? "Update API Key" : "Select API Key"}
                  </button>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Storyboard Aspect Ratio</label>
                  <p className="text-sm text-slate-500 mb-4">
                    Set the aspect ratio for all storyboard generations and their corresponding layout references.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["1:1", "3:4", "4:3", "9:16", "16:9"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setStoryboardAspectRatio(ratio)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          storyboardAspectRatio === ratio 
                            ? "bg-sky-500 border-sky-400 text-slate-950" 
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Storyboard Image Prompt Template</label>
                  <p className="text-sm text-slate-500 mb-4">
                    The base style and continuity instructions used for all storyboard frame generations.
                  </p>
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Global Style</p>
                      <pre className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">{GLOBAL_STYLE}</pre>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Subtitle Style</p>
                      <pre className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">{SUBTITLE_STYLE}</pre>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Continuity Instruction</p>
                      <pre className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">CRITICAL: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly.</pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group by Sequence */}
            {Array.from(new Set(storyboard.map(p => p.sequence))).map(seqName => (
              <div key={seqName} className="space-y-4">
                <div className="flex flex-col gap-1 border-l-2 border-sky-500 pl-4 py-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">{seqName}</h3>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                      {storyboard.filter(p => p.sequence === seqName).length} Beats
                    </span>
                  </div>
                  {sequenceSummaries[seqName] && (
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-2xl italic">
                      {sequenceSummaries[seqName]}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {storyboard.filter(p => p.sequence === seqName).map(page => (
                    <div key={page.id} className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 hover:border-slate-700/50 transition-all">
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Left: Info & Controls */}
                        <div className="lg:w-1/4 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                              </div>
                            </div>
                          </div>

                          {/* Beat Breakdown */}
                          <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Clapperboard size={14} className="text-sky-500" />
                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest">
                                  Full Prompt
                                </h5>
                              </div>
                            </div>
                            
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                <p className="text-[10px] text-slate-400 leading-relaxed italic whitespace-pre-wrap">
                                  {getPromptData(page, "full_layout").composite}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-400">
                              <MapPin size={16} className="text-sky-500" />
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:text-sky-400 transition-colors"
                                onClick={() => {
                                  const loc = sharedLocs[page.loc.prompt];
                                  if (loc?.result?.image) {
                                    setModalData({
                                      isOpen: true,
                                      imageUrl: loc.result.image,
                                      title: page.loc.title,
                                      prompt: loc.result.settings.prompt,
                                      feedback: loc.result.feedback,
                                      settings: loc.result.settings
                                    });
                                  }
                                }}
                              >
                                <span className="text-xs font-bold uppercase tracking-widest">{page.loc.title}</span>
                                {sharedLocs[page.loc.prompt]?.result?.image && (
                                  <div className="w-6 h-6 rounded border border-slate-700 overflow-hidden bg-slate-800">
                                    <img src={sharedLocs[page.loc.prompt].result.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <div 
                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 pr-3 pl-1 py-1 rounded-full border border-slate-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                                onClick={() => {
                                  const layoutImg = generateScriptLayout(page.frames || [], "full", storyboardAspectRatio);
                                  setModalData({
                                    isOpen: true,
                                    imageUrl: layoutImg,
                                    title: "Generated Layout",
                                    prompt: "Script-driven layout",
                                    feedback: "Generated automatically from script frames.",
                                    settings: { prompt: "Script Layout", size: "2K", hasLayoutRef: false }
                                  });
                                }}
                              >
                                <div className="w-6 h-6 rounded-full border border-slate-600 overflow-hidden bg-slate-700 shrink-0">
                                  <img src={generateScriptLayout(page.frames || [], "full", storyboardAspectRatio)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Layout size={10} className="text-slate-400" />
                                  <span>Layout</span>
                                </div>
                              </div>
                              {page.chars.map(cid => (
                                <div 
                                  key={cid} 
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 pr-3 pl-1 py-1 rounded-full border border-slate-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                                  onClick={() => {
                                    const char = sharedChars[cid];
                                    if (char?.result?.image) {
                                      setModalData({
                                        isOpen: true,
                                        imageUrl: char.result.image,
                                        title: masterChars[cid]?.name || cid,
                                        prompt: char.result.settings.prompt,
                                        feedback: char.result.feedback,
                                        settings: char.result.settings
                                      });
                                    }
                                  }}
                                >
                                  {sharedChars[cid]?.result?.image && (
                                    <div className="w-6 h-6 rounded-full border border-slate-600 overflow-hidden bg-slate-700 shrink-0">
                                      <img src={sharedChars[cid].result.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <User size={10} className="text-slate-400" />
                                    <span>{masterChars[cid]?.name || cid}</span>
                                  </div>
                                </div>
                              ))}
                              {(page.props || []).map(pid => (
                                <div 
                                  key={pid} 
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 pr-3 pl-1 py-1 rounded-full border border-slate-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                                  onClick={() => {
                                    const prop = sharedProps[pid];
                                    if (prop?.result?.image) {
                                      setModalData({
                                        isOpen: true,
                                        imageUrl: prop.result.image,
                                        title: masterProps[pid]?.name || pid,
                                        prompt: prop.result.settings.prompt,
                                        feedback: prop.result.feedback,
                                        settings: prop.result.settings
                                      });
                                    }
                                  }}
                                >
                                  {sharedProps[pid]?.result?.image && (
                                    <div className="w-6 h-6 rounded-full border border-slate-600 overflow-hidden bg-slate-700 shrink-0">
                                      <img src={sharedProps[pid].result.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Box size={10} className="text-slate-400" />
                                    <span>{masterProps[pid]?.name || pid}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                            <div className="pt-6 border-t border-slate-800/50">
                              <button 
                                onClick={() => runProductionCycle(page.id)}
                                disabled={results[page.id]?.loadingMode !== null}
                                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 mb-3"
                              >
                                <Play size={16} />
                                {results[page.id]?.loadingMode ? "Generating..." : "Run Production Cycle"}
                              </button>
                              <p className="text-[10px] text-center font-bold text-slate-500 uppercase tracking-widest">
                                Generates F-Layout Track + References
                              </p>
                            </div>
                        </div>

                        {/* Right: Results Track */}
                        <div className="lg:w-3/4">
                          <div className={`bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative group ${
                            storyboardAspectRatio === "16:9" ? "aspect-video" :
                            storyboardAspectRatio === "9:16" ? "aspect-[9/16]" :
                            storyboardAspectRatio === "3:4" ? "aspect-[3/4]" :
                            storyboardAspectRatio === "4:3" ? "aspect-[4/3]" :
                            "aspect-square"
                          }`}>
                            {(() => {
                              const currentResult = results[page.id]?.story2K_layout;
                              const stalenessReason = getStalenessReason(page, currentResult);

                              return currentResult?.image ? (
                                <div 
                                  className="w-full h-full relative cursor-pointer"
                                  onClick={() => setModalData({ 
                                    isOpen: true, 
                                    imageUrl: currentResult.image, 
                                    title: `${page.title} - Full Layout`,
                                    prompt: currentResult.settings.prompt,
                                    feedback: currentResult.feedback,
                                    settings: currentResult.settings
                                  })}
                                >
                                  <img 
                                    src={currentResult.image} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  {stalenessReason && (
                                    <div className="absolute top-4 left-4 right-4 bg-amber-500/90 backdrop-blur-md text-slate-950 p-3 rounded-xl flex items-center gap-3 z-20 shadow-2xl border border-amber-400/50">
                                      <AlertCircle size={18} className="shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Stale Asset Detected</p>
                                        <p className="text-[9px] font-bold opacity-80 leading-tight">{stalenessReason}. Run production cycle again to sync.</p>
                                      </div>
                                      <RefreshCw size={14} className="opacity-50" />
                                    </div>
                                  )}
                                  <IntentBox title="Full Layout Director's Intent" content={currentResult.feedback} />
                                </div>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center relative">
                                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                                    <img 
                                      src={generateScriptLayout(page.frames || [], "full", storyboardAspectRatio)} 
                                      className="w-full h-full object-cover grayscale invert"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="p-6 bg-slate-900 rounded-full mb-6 relative z-10">
                                    <Clapperboard className="text-slate-700" size={64} />
                                  </div>
                                  <h5 className="text-lg font-black text-white italic mb-2 uppercase tracking-tighter relative z-10">Awaiting Production Cycle</h5>
                                  <p className="text-slate-500 text-xs leading-relaxed max-w-sm relative z-10">
                                    This track will generate a 4x4 grid of the full 16-frame temporal sequence for maximum granular detail.
                                  </p>
                                  <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md relative z-10">
                                    <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Location Sync</p>
                                      <p className="text-[10px] text-slate-300 font-bold truncate">{page.loc.title}</p>
                                    </div>
                                    <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Cast Sync</p>
                                      <p className="text-[10px] text-slate-300 font-bold truncate">{page.chars.length} Characters</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {results[page.id]?.loadingMode === "full_layout" && (
                              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                                <Loader2 className="animate-spin text-sky-500" size={48} />
                                <div className="text-center">
                                  <p className="text-sky-400 text-xs font-black uppercase tracking-widest mb-1">{results[page.id].status}</p>
                                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Gemini is rendering frames...</p>
                                  {results[page.id].startTime && (
                                    <p className="text-sky-500/50 text-[10px] font-mono mt-2">
                                      ELAPSED: {Math.floor((currentTime - results[page.id].startTime!) / 1000)}s
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )}

  <AnimatePresence>
    {toast && <Toast message={toast} onHide={() => setToast(null)} />}
  </AnimatePresence>

  <ImageModal 
    isOpen={modalData.isOpen}
    onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
    imageUrl={modalData.imageUrl}
    title={modalData.title}
    prompt={modalData.prompt}
    feedback={modalData.feedback}
  />

  <footer className="mt-32 border-t border-slate-800 pt-12 pb-24 flex flex-col md:flex-row justify-between items-center gap-8">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
        <Zap className="text-slate-950" size={16} />
      </div>
      <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">TETHER PRODUCTION BIBLE v2.0</span>
    </div>
    <div className="flex gap-8">
      <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">Script-Driven Multimodal Pipeline</span>
    </div>
  </footer>
</div>
  );
}
