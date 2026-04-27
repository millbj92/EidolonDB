import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const { name, email, subject, message, type } = payload;

  if (type === 'capabilities-waitlist') {
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
    }

    if (!process.env['RESEND_API_KEY']) {
      return NextResponse.json({ message: 'Email service not configured.' }, { status: 503 });
    }

    try {
      const resend = new Resend(process.env['RESEND_API_KEY']);
      await resend.emails.send({
        from: 'Eidolon Waitlist <support@eidolondb.com>',
        to: 'millbj92@gmail.com',
        replyTo: email.trim(),
        subject: '[Eidolon] Capabilities Cloud waitlist',
        text: `Type: capabilities-waitlist\nEmail: ${email.trim()}`,
        html: `
          <p><strong>Type:</strong> capabilities-waitlist</p>
          <p><strong>Email:</strong> <a href="mailto:${email.trim()}">${email.trim()}</a></p>
        `,
      });

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('Resend error:', err);
      return NextResponse.json({ message: 'Failed to send message. Please try again.' }, { status: 500 });
    }
  }

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return NextResponse.json({ message: 'Name, email, and message are required.' }, { status: 400 });
  }

  const subjectLine =
    typeof subject === 'string' && subject.trim() ? subject.trim() : 'EidolonDB Support Request';

  if (!process.env['RESEND_API_KEY']) {
    return NextResponse.json({ message: 'Email service not configured.' }, { status: 503 });
  }

  try {
    const resend = new Resend(process.env['RESEND_API_KEY']);
    await resend.emails.send({
      from: 'EidolonDB Support <support@eidolondb.com>',
      to: 'millbj92@gmail.com',
      replyTo: email.trim(),
      subject: `[EidolonDB Support] ${subjectLine}`,
      text: `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`,
      html: `
        <p><strong>Name:</strong> ${name.trim()}</p>
        <p><strong>Email:</strong> <a href="mailto:${email.trim()}">${email.trim()}</a></p>
        <p><strong>Subject:</strong> ${subjectLine}</p>
        <hr />
        <p>${message.trim().replace(/\n/g, '<br />')}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return NextResponse.json({ message: 'Failed to send message. Please try again.' }, { status: 500 });
  }
}
