/**
 * Barrel file for phosphor-react-native icons.
 *
 * Imports each icon from its individual source file instead of the package barrel,
 * so Metro only bundles the ~30 icons we actually use (not all 1500+).
 *
 * Tree-shaking workaround: Metro doesn't support tree shaking, so importing from
 * "phosphor-react-native" pulls the entire 8MB index. This file fixes that.
 *
 * Every name the app imports must be re-exported here. A missing one is not a
 * build error at runtime — it resolves to `undefined`, and rendering
 * `<undefined />` throws. That is how the 2.4.5 Android update crashed on
 * launch: HouseIcon, ShoppingCartIcon and TagIcon are in the tab bar.
 * `bun run typecheck` catches it; the icon errors read
 * "Module '#/lib/icons' has no exported member".
 */

/**
 * Types only, so this is erased before Metro sees it — re-exporting them from
 * the package root costs nothing at runtime, unlike a value import would.
 */
export type { Icon, IconProps } from "phosphor-react-native";
export { IconContext } from "phosphor-react-native";

export { ArrowBendUpLeftIcon } from "phosphor-react-native/src/icons/ArrowBendUpLeft";
export { ArrowClockwiseIcon } from "phosphor-react-native/src/icons/ArrowClockwise";
export { ArrowCounterClockwiseIcon } from "phosphor-react-native/src/icons/ArrowCounterClockwise";
export { ArrowLeftIcon } from "phosphor-react-native/src/icons/ArrowLeft";
export { ArrowSquareOutIcon } from "phosphor-react-native/src/icons/ArrowSquareOut";
export { ArticleIcon } from "phosphor-react-native/src/icons/Article";
export { BellIcon } from "phosphor-react-native/src/icons/Bell";
export { BellRingingIcon } from "phosphor-react-native/src/icons/BellRinging";
export { CakeIcon } from "phosphor-react-native/src/icons/Cake";
export { CalendarIcon } from "phosphor-react-native/src/icons/Calendar";
export { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown";
export { CaretLeftIcon } from "phosphor-react-native/src/icons/CaretLeft";
export { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
export { ChartLineIcon } from "phosphor-react-native/src/icons/ChartLine";
export { ChatIcon } from "phosphor-react-native/src/icons/Chat";
export { ChatDotsIcon } from "phosphor-react-native/src/icons/ChatDots";
export { CheckCircleIcon } from "phosphor-react-native/src/icons/CheckCircle";
export { ClipboardIcon } from "phosphor-react-native/src/icons/Clipboard";
export { ClockIcon } from "phosphor-react-native/src/icons/Clock";
export { CoinsIcon } from "phosphor-react-native/src/icons/Coins";
export { ConfettiIcon } from "phosphor-react-native/src/icons/Confetti";
export { CopyIcon } from "phosphor-react-native/src/icons/Copy";
export { DeviceMobileIcon } from "phosphor-react-native/src/icons/DeviceMobile";
export { DiceFiveIcon } from "phosphor-react-native/src/icons/DiceFive";
export { DotsThreeOutlineVerticalIcon } from "phosphor-react-native/src/icons/DotsThreeOutlineVertical";
export { DotsThreeVerticalIcon } from "phosphor-react-native/src/icons/DotsThreeVertical";
export { EnvelopeSimpleIcon } from "phosphor-react-native/src/icons/EnvelopeSimple";
export { EyeIcon } from "phosphor-react-native/src/icons/Eye";
export { EyeSlashIcon } from "phosphor-react-native/src/icons/EyeSlash";
export { FacebookLogoIcon } from "phosphor-react-native/src/icons/FacebookLogo";
export { FileArrowUpIcon } from "phosphor-react-native/src/icons/FileArrowUp";
export { GiftIcon } from "phosphor-react-native/src/icons/Gift";
export { HandshakeIcon } from "phosphor-react-native/src/icons/Handshake";
export { HardDrivesIcon } from "phosphor-react-native/src/icons/HardDrives";
export { HeartIcon } from "phosphor-react-native/src/icons/Heart";
export { HeartStraightIcon } from "phosphor-react-native/src/icons/HeartStraight";
export { HouseIcon } from "phosphor-react-native/src/icons/House";
export { IdentificationBadgeIcon } from "phosphor-react-native/src/icons/IdentificationBadge";
export { InfoIcon } from "phosphor-react-native/src/icons/Info";
export { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
export { LockKeyIcon } from "phosphor-react-native/src/icons/LockKey";
export { MegaphoneIcon } from "phosphor-react-native/src/icons/Megaphone";
export { MessengerLogoIcon } from "phosphor-react-native/src/icons/MessengerLogo";
export { MinusCircleIcon } from "phosphor-react-native/src/icons/MinusCircle";
export { MonitorIcon } from "phosphor-react-native/src/icons/Monitor";
export { MusicNoteIcon } from "phosphor-react-native/src/icons/MusicNote";
export { NewspaperIcon } from "phosphor-react-native/src/icons/Newspaper";
export { PackageIcon } from "phosphor-react-native/src/icons/Package";
export { PaperPlaneTiltIcon } from "phosphor-react-native/src/icons/PaperPlaneTilt";
export { PauseIcon } from "phosphor-react-native/src/icons/Pause";
export { PencilSimpleLineIcon } from "phosphor-react-native/src/icons/PencilSimpleLine";
export { PhoneCallIcon } from "phosphor-react-native/src/icons/PhoneCall";
export { PlayIcon } from "phosphor-react-native/src/icons/Play";
export { PlayCircleIcon } from "phosphor-react-native/src/icons/PlayCircle";
export { PlusCircleIcon } from "phosphor-react-native/src/icons/PlusCircle";
export { SealQuestionIcon } from "phosphor-react-native/src/icons/SealQuestion";
export { ShareIcon } from "phosphor-react-native/src/icons/Share";
export { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
export { ShieldCheckIcon } from "phosphor-react-native/src/icons/ShieldCheck";
export { ShoppingCartIcon } from "phosphor-react-native/src/icons/ShoppingCart";
export { SketchLogoIcon } from "phosphor-react-native/src/icons/SketchLogo";
export { SkipBackIcon } from "phosphor-react-native/src/icons/SkipBack";
export { SkipForwardIcon } from "phosphor-react-native/src/icons/SkipForward";
export { SpeakerHighIcon } from "phosphor-react-native/src/icons/SpeakerHigh";
export { SpeakerSlashIcon } from "phosphor-react-native/src/icons/SpeakerSlash";
export { SpeakerXIcon } from "phosphor-react-native/src/icons/SpeakerX";
export { StarIcon } from "phosphor-react-native/src/icons/Star";
export { TagIcon } from "phosphor-react-native/src/icons/Tag";
export { ThumbsDownIcon } from "phosphor-react-native/src/icons/ThumbsDown";
export { ThumbsUpIcon } from "phosphor-react-native/src/icons/ThumbsUp";
export { TicketIcon } from "phosphor-react-native/src/icons/Ticket";
export { TrashIcon } from "phosphor-react-native/src/icons/Trash";
export { TrophyIcon } from "phosphor-react-native/src/icons/Trophy";
export { TwitterLogoIcon } from "phosphor-react-native/src/icons/TwitterLogo";
export { UserIcon } from "phosphor-react-native/src/icons/User";
export { UserMinusIcon } from "phosphor-react-native/src/icons/UserMinus";
export { UsersIcon } from "phosphor-react-native/src/icons/Users";
export { WarningIcon } from "phosphor-react-native/src/icons/Warning";
export { WarningCircleIcon } from "phosphor-react-native/src/icons/WarningCircle";
export { WhatsappLogoIcon } from "phosphor-react-native/src/icons/WhatsappLogo";
export { X, XIcon } from "phosphor-react-native/src/icons/X";
export { XCircleIcon } from "phosphor-react-native/src/icons/XCircle";
