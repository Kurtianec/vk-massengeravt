import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Инициализация базы данных...');

  // Create admin user if no users exist
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.scryptSync('admin123', salt, 64).toString('hex');
    const passwordHash = `${salt}:${key}`;

    const admin = await prisma.user.create({
      data: {
        email: 'admin@vk-messages.ru',
        passwordHash,
        name: 'Администратор',
        role: 'admin',
      },
    });
    console.log(`✓ Создан администратор: ${admin.email} (пароль: admin123)`);
    console.log('  ⚠ Обязательно смените пароль после первого входа!');
  } else {
    console.log(`✓ Пользователи уже существуют (${userCount}), пропускаем`);
  }

  // Ensure default settings exist
  const settingsCount = await prisma.setting.count();
  if (settingsCount === 0) {
    await prisma.setting.create({
      data: {
        key: 'vk_app_id',
        value: '',
      },
    });
    console.log('✓ Созданы настройки по умолчанию');
  }

  console.log('Инициализация завершена!');
}

main()
  .catch((e) => {
    console.error('Ошибка инициализации:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
