import AlertDialog from '../components/dialogs/AlertDialog.vue';
import LoginDialog from '../components/dialogs/LoginDialog.vue';
import LoginLiveDialog from '../components/dialogs/LoginLiveDialog.vue';
import MenuPopup from '../components/dialogs/MenuPopup.vue';
import SquareKermaDialog from '../components/dialogs/SquareKermaDialog.vue';
import RecentVotesDialog from '../components/dialogs/RecentVotesDialog.vue';
import SysGateDialog from '../sys/SysGateDialog.vue';
import NotificationToast from '../components/dialogs/NotificationToast.vue';
import CrowdSelectorDialog from '../components/dialogs/CrowdSelectorDialog.vue';
import VoteCreatorDialog from '../components/dialogs/VoteCreatorDialog.vue';
import UploadDialog from '../components/dialogs/UploadDialog.vue';
import WashGuardDialog from '../components/dialogs/WashGuardDialog.vue';
import BroadcastDialog from '../components/dialogs/BroadcastDialog.vue';
import ReconnectDialog from '../components/dialogs/ReconnectDialog.vue';
import CoAnchorDialog from '../components/dialogs/CoAnchorDialog.vue';
import DismissAnchorDialog from '../components/dialogs/DismissAnchorDialog.vue';
import MinKermaDialog from '../components/dialogs/MinKermaDialog.vue';
import SmileyDialog from '../components/dialogs/SmileyDialog.vue';
import EditPosterDialog from '../components/dialogs/EditPosterDialog.vue';

export const OVERLAYS = {
  alert: AlertDialog,
  login: LoginDialog,
  loginLive: LoginLiveDialog,
  menu: MenuPopup,
  kerma: SquareKermaDialog,
  recentVotes: RecentVotesDialog,
  sysGate: SysGateDialog,
  toast: NotificationToast,
  crowd: CrowdSelectorDialog,
  voteCreator: VoteCreatorDialog,
  upload: UploadDialog,
  washGuard: WashGuardDialog,
  broadcast: BroadcastDialog,
  reconnect: ReconnectDialog,
  coAnchor: CoAnchorDialog,
  dismissAnchor: DismissAnchorDialog,
  minKerma: MinKermaDialog,
  smiley: SmileyDialog,
  editPoster: EditPosterDialog,
} as const;

export type OverlayKind = keyof typeof OVERLAYS;

export interface OverlaySpec {
  kind: OverlayKind;
  props?: Record<string, unknown>;
}
