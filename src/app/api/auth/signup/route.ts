import { NextResponse } from 'next/server';

const BLOCKED_RESPONSE = {
  ok: false,
  code: 'PUBLIC_SIGNUP_DISABLED',
  error: 'التسجيل العام معطّل نهائياً. إنشاء الحسابات الجديدة متاح لمدير النظام فقط من صفحة إدارة المستخدمين.',
};

export async function GET() {
  return NextResponse.json(BLOCKED_RESPONSE, { status: 403 });
}

export async function POST() {
  return NextResponse.json(BLOCKED_RESPONSE, { status: 403 });
}

export async function PUT() {
  return NextResponse.json(BLOCKED_RESPONSE, { status: 403 });
}

export async function PATCH() {
  return NextResponse.json(BLOCKED_RESPONSE, { status: 403 });
}

export async function DELETE() {
  return NextResponse.json(BLOCKED_RESPONSE, { status: 403 });
}
