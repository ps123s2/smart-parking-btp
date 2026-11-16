/**
 * Re-exports the refined NavigationTransition.
 * The cartoonish cumulus cloud animation has been completely removed in favor of
 * a clean, modern, and snappy Apple Maps / Uber-inspired navigation transition.
 */
export {
  NavigationTransition as CloudSplittingTransition,
  triggerNavigationTransition as triggerCloudSplitTransition,
  NAV_TRANSITION_EVENT as CLOUD_SPLIT_EVENT,
} from './NavigationTransition';
