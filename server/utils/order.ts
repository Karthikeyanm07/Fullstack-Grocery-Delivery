import { OrderStatus, Prisma } from "../generated/prisma/client.js";

export const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = [
	OrderStatus.Confirmed,
	OrderStatus.Preparing,
	OrderStatus.OutForDelivery,
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
	OrderStatus.Delivered,
	OrderStatus.Cancelled,
];

export const appendStatusHistory = (
	statusHistory: unknown,
	status: OrderStatus,
	note: string,
): Prisma.InputJsonValue => {
	const history = Array.isArray(statusHistory) ? [...statusHistory] : [];
	history.push({
		status,
		note,
		timestamp: new Date().toISOString(),
	});

	return history as Prisma.InputJsonValue;
};

export const isTerminalOrderStatus = (status: OrderStatus): boolean =>
	TERMINAL_ORDER_STATUSES.includes(status);

export const canTransitionOrderStatus = (
	currentStatus: OrderStatus,
	nextStatus: OrderStatus,
): boolean => {
	if (currentStatus === nextStatus) {
		return true;
	}

	if (currentStatus === OrderStatus.Cancelled) {
		return false;
	}

	if (currentStatus === OrderStatus.Delivered) {
		return false;
	}

	const order: OrderStatus[] = [
		OrderStatus.Placed,
		OrderStatus.Confirmed,
		OrderStatus.Preparing,
		OrderStatus.OutForDelivery,
		OrderStatus.Delivered,
	];

	if (nextStatus === OrderStatus.Cancelled) {
		return true;
	}

	return order.indexOf(nextStatus) >= order.indexOf(currentStatus);
};
