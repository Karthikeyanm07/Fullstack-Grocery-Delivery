import { createTransport, type Transporter } from "nodemailer";

const isEmailConfigured = (): boolean =>
	Boolean(
		process.env.SMTP_USER &&
			process.env.SMTP_PASS &&
			process.env.SENDER_EMAIL,
	);

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
	if (!isEmailConfigured()) {
		throw new Error(
			"Missing email config: SMTP_USER, SMTP_PASS, and SENDER_EMAIL must be set.",
		);
	}

	if (!transporter) {
		transporter = createTransport({
			host: "smtp-relay.brevo.com",
			port: 587,
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS,
			},
		});
	}

	return transporter;
};

const sendEmail = async ({
	to,
	subject,
	body,
}: {
	to: string | string[];
	subject: string;
	body: string;
}) => {
	const transport = getTransporter();
	return transport.sendMail({
		from: process.env.SENDER_EMAIL,
		to: Array.isArray(to) ? to.join(", ") : to,
		subject,
		html: body,
	});
};

export default sendEmail;
