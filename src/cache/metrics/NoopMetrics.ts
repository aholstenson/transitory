import { MetricsRecorder } from './MetricsRecorder';

const noop: () => void = () => undefined;

export const NoopMetrics: MetricsRecorder = Object.freeze({
	hitRate: 1.0,
	hits: 0,
	misses: 0,
	record: noop,
	reset: noop,
	count: noop,
	hit: noop,
	miss: noop,
} satisfies MetricsRecorder);
