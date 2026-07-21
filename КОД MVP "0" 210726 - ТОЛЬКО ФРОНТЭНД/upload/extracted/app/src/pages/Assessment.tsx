import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RotateCcw,
  Lightbulb,
  ArrowRight,
  Map as MapIcon,
  ClipboardCheck,
  Beaker,
  Factory,
  FileText,
  Zap,
  Info,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { UGT_LEVELS } from '@/data/ugtData';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ChecklistItem {
  id: string;
  text: string;
  category: 'scientific' | 'technical' | 'organizational' | 'production';
  description: string;
}

interface StepData {
  levelId: number;
  items: ChecklistItem[];
}

interface ProjectInfo {
  name: string;
  description: string;
  category: string;
  targetLevel: number;
}

type WizardStep = 'info' | number | 'results'; // info=project form, 0-8=UGT steps, results=final

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */
const CATEGORY_CONFIG = {
  scientific: { label: 'Научные', color: '#4A82FF', icon: Beaker },
  technical: { label: 'Технические', color: '#10B981', icon: Zap },
  organizational: { label: 'Организационные', color: '#E5C840', icon: ClipboardCheck },
  production: { label: 'Производственные', color: '#FF7A2E', icon: Factory },
} as const;

/* ------------------------------------------------------------------ */
/*  Checklist data per UGT level with detailed descriptions            */
/* ------------------------------------------------------------------ */
const STEP_CHECKLISTS: StepData[] = [
  {
    levelId: 1,
    items: [
      {
        id: 'ugt1_1',
        text: 'Сформулирована идея разработки новой технологии',
        category: 'scientific',
        description:
          'На этом этапе формируется первоначальная научная гипотеза или инженерная идея, которая может стать основой для новой технологии. Идея должна быть зафиксирована в виде концептуального описания, научной записки или заявки на изобретение.',
      },
      {
        id: 'ugt1_2',
        text: 'Определены используемые физические законы и допущения',
        category: 'scientific',
        description:
          'Необходимо чётко указать, какие фундаментальные физические принципы лежат в основе технологии, а также какие упрощения и допущения принимаются при реализации. Это обеспечивает научную обоснованность подхода.',
      },
      {
        id: 'ugt1_3',
        text: 'Существует концепция для реализации в ПО',
        category: 'technical',
        description:
          'Разработана архитектурная концепция программного обеспечения, включающая выбор технологического стека, базовые алгоритмы и структуру данных. Концепция должна быть достаточно детализирована для оценки технической осуществимости.',
      },
      {
        id: 'ugt1_4',
        text: 'Известно в общих чертах, что должно делать ПО',
        category: 'technical',
        description:
          'Сформулированы ключевые функциональные требования к программному обеспечению на уровне общего описания. Понятны основные входные и выходные данные, а также ожидаемый результат работы системы.',
      },
      {
        id: 'ugt1_5',
        text: 'Предварительные расчёты подтверждают базовые принципы',
        category: 'scientific',
        description:
          'Проведены аналитические расчёты или компьютерное моделирование, результаты которых подтверждают работоспособность предложенных принципов. Расчёты должны быть документированы и доступны для проверки.',
      },
      {
        id: 'ugt1_6',
        text: 'Подготовлены математические формулировки концепций',
        category: 'technical',
        description:
          'Разработаны математические модели и формулы, описывающие работу технологии. Математический аппарат позволяет количественно оценить поведение системы при различных входных параметрах.',
      },
      {
        id: 'ugt1_7',
        text: 'Имеется идея с базовыми принципами алгоритма',
        category: 'technical',
        description:
          'Сформировано описание базового алгоритма, лежащего в основе технологии. Алгоритм может быть представлен в виде блок-схемы, псевдокода или текстового описания последовательности операций.',
      },
      {
        id: 'ugt1_8',
        text: 'Опубликованы научные обзоры/результаты',
        category: 'scientific',
        description:
          'Результаты исследований опубликованы в рецензируемых научных журналах, материалах конференций или других научных изданиях. Публикации прошли независимое рецензирование и доступны научному сообществу.',
      },
      {
        id: 'ugt1_9',
        text: 'Опубликованы базовые научные принципы',
        category: 'scientific',
        description:
          'Фундаментальные научные принципы, лежащие в основе технологии, представлены в виде научных статей, монографий или патентных заявок. Это обеспечивает приоритет и защиту интеллектуальной собственности.',
      },
    ],
  },
  {
    levelId: 2,
    items: [
      {
        id: 'ugt2_1',
        text: 'Определена спецификация концепции',
        category: 'organizational',
        description:
          'Разработан документ, детально описывающий технологическую концепцию, включая цели, задачи, основные компоненты, ограничения и предполагаемые результаты. Спецификация служит основой для дальнейшей разработки.',
      },
      {
        id: 'ugt2_2',
        text: 'Обоснована необходимость создания новой технологии',
        category: 'technical',
        description:
          'Проведён анализ существующих решений на рынке, обосновывающий, почему ни одно из них не удовлетворяет требованиям. Подготовлено технико-экономическое обоснование с оценкой ожидаемых преимуществ новой технологии.',
      },
      {
        id: 'ugt2_3',
        text: 'Проведены расчётные исследования и моделирование',
        category: 'technical',
        description:
          'Выполнены детальные инженерные расчёты и компьютерное моделирование отдельных компонентов системы. Результаты подтверждают возможность достижения целевых характеристик при проектных параметрах.',
      },
      {
        id: 'ugt2_4',
        text: 'Доказана эффективность использования идеи',
        category: 'technical',
        description:
          'Получены убедительные доказательства эффективности предложенного подхода в виде результатов моделирования, аналитических оценок или предварительных экспериментов. Эффективность подтверждена количественными показателями.',
      },
      {
        id: 'ugt2_5',
        text: 'Подготовлено техническое задание',
        category: 'organizational',
        description:
          'Разработан полный комплект технического задания в соответствии с ГОСТ 19.201-78 или аналогичным стандартом. Техническое задание включает все разделы: общие сведения, назначение, требования к функциональности, надёжности, безопасности и эксплуатации.',
      },
      {
        id: 'ugt2_6',
        text: 'Оценены производственные риски',
        category: 'organizational',
        description:
          'Проведён анализ рисков, связанных с дальнейшей разработкой и внедрением технологии. Для каждого значимого риска разработан план митигации с оценкой затрат и сроков на реализацию мер по снижению рисков.',
      },
    ],
  },
  {
    levelId: 3,
    items: [
      {
        id: 'ugt3_1',
        text: 'Подтверждены ключевые функциональные характеристики',
        category: 'technical',
        description:
          'Ключевые функциональные характеристики (КФХ) — критические параметры, определяющие пригодность технологии для решения поставленных задач. Проведены эксперименты или расчёты, результаты которых подтверждают достижимость целевых значений КФХ.',
      },
      {
        id: 'ugt3_2',
        text: 'Проведены лабораторные эксперименты на мелкомасштабных моделях',
        category: 'technical',
        description:
          'В контролируемых лабораторных условиях проведены эксперименты на уменьшенных или упрощённых моделях системы. Эксперименты позволили проверить работоспособность ключевых компонентов и определить параметры для дальнейшей разработки.',
      },
      {
        id: 'ugt3_3',
        text: 'Детальные комплексные расчётные исследования выполнены',
        category: 'technical',
        description:
          'Выполнен полный комплекс инженерных расчётов с детальным моделированием всех ключевых процессов. Расчёты учитывают взаимосвязи между компонентами системы и позволяют оптимизировать конструктивные параметры.',
      },
      {
        id: 'ugt3_4',
        text: 'Отобраны работы для дальнейшей разработки',
        category: 'organizational',
        description:
          'На основе результатов исследований и анализа рисков принято решение о продолжении разработки. Определены приоритетные направления работ, выделены ресурсы и назначены ответственные исполнители на следующем этапе.',
      },
      {
        id: 'ugt3_5',
        text: 'Подготовлен отчёт об исследованиях',
        category: 'organizational',
        description:
          'Оформлен полный отчёт о научно-исследовательских работах (НИР), включающий постановку задачи, методику исследований, полученные результаты, анализ и выводы. Отчёт прошёл внутреннюю экспертизу и утверждён в установленном порядке.',
      },
      {
        id: 'ugt3_6',
        text: 'Определены ключевые риски',
        category: 'organizational',
        description:
          'Идентифицированы наиболее значимые технические, организационные и внешние риски, которые могут повлиять на успешность дальнейшей разработки. Для каждого риска определена вероятность наступления, потенциальное влияние и стратегия управления.',
      },
    ],
  },
  {
    levelId: 4,
    items: [
      {
        id: 'ugt4_1',
        text: 'Макеты проверены в лабораторных условиях',
        category: 'technical',
        description:
          'Созданы и испытаны лабораторные макеты отдельных компонентов или подсистем в контролируемых условиях. Макеты демонстрируют работоспособность технических решений и позволяют измерить ключевые параметры в реальном физическом исполнении.',
      },
      {
        id: 'ugt4_2',
        text: 'Продемонстрирована работоспособность компонентов',
        category: 'technical',
        description:
          'Каждый ключевой компонент системы прошёл функциональные испытания, подтверждающие его способность выполнять возложенные функции в соответствии с установленными требованиями. Результаты задокументированы в протоколах испытаний.',
      },
      {
        id: 'ugt4_3',
        text: 'Проверена совместимость технологий',
        category: 'technical',
        description:
          'Проведены интеграционные испытания, подтверждающие корректную совместную работу всех компонентов системы. Выявлены и устранены конфликты на интерфейсах, обеспечена совместимость программных и аппаратных модулей.',
      },
      {
        id: 'ugt4_4',
        text: 'Определены ключевые параметры дизайна',
        category: 'organizational',
        description:
          'Установлены и зафиксированы в технической документации ключевые конструктивные параметры системы: габариты, масса, энергопотребление, тепловыделение и другие критические характеристики, влияющие на дальнейшее проектирование.',
      },
      {
        id: 'ugt4_5',
        text: 'Подготовлены протоколы испытаний',
        category: 'organizational',
        description:
          'Разработаны и утверждены программы и методики испытаний, включающие состав контролируемых параметров, допустимые значения, порядок проведения испытаний и критерии приёмки. Все испытания оформлены протоколами установленной формы.',
      },
      {
        id: 'ugt4_6',
        text: 'Техническая документация оформлена',
        category: 'organizational',
        description:
          'Подготовлен комплект конструкторской и программной документации, включающий технические условия, чертежи, спецификации, описания программ и эксплуатационные документы. Документация соответствует требованиям единой системы программной документации (ЕСПД).',
      },
    ],
  },
  {
    levelId: 5,
    items: [
      {
        id: 'ugt5_1',
        text: 'Компоненты интегрированы с поддерживающими элементами',
        category: 'technical',
        description:
          'Основные технологические компоненты собраны в единый комплекс со всеми вспомогательными системами: питанием, охлаждением, креплением, защитой от внешних воздействий. Проверена работоспособность системы в полной конфигурации.',
      },
      {
        id: 'ugt5_2',
        text: 'Испытания в моделируемых условиях проведены',
        category: 'technical',
        description:
          'Система прошла испытания на специализированном стендовом оборудовании, воспроизводящем ключевые факторы реальной эксплуатационной среды. Результаты подтвердили работоспособность в условиях, приближённых к реальным.',
      },
      {
        id: 'ugt5_3',
        text: 'Достигнут уровень промежуточных/полных масштабов',
        category: 'technical',
        description:
          'От лабораторных образцов произведён переход к опытным образцам, выполненным в габаритах и с использованием материалов, близких к серийному производству. Подтверждена возможность масштабирования технологических процессов.',
      },
      {
        id: 'ugt5_4',
        text: 'Стендовые испытания пройдены',
        category: 'technical',
        description:
          'Проведён полный цикл стендовых испытаний, включающий функциональный контроль, проверку работоспособности в предельных режимах, длительные испытания на отказ и оценку надёжности. Получены положительные результаты по всем контрольным точкам.',
      },
      {
        id: 'ugt5_5',
        text: 'Отчёт по интеграции подготовлен',
        category: 'organizational',
        description:
          'Оформлен отчёт о проведении интеграции компонентов, включающий описание выполненных работ, выявленные проблемы и способы их решения, результаты интеграционных испытаний и рекомендации по дальнейшей эксплуатации системы.',
      },
      {
        id: 'ugt5_6',
        text: 'Оценена готовность производства',
        category: 'production',
        description:
          'Проведена предварительная оценка готовности производственной базы для изготовления опытной партии продукции. Определены необходимые капитальные вложения, требования к оборудованию, оснастке и квалификации персонала.',
      },
    ],
  },
  {
    levelId: 6,
    items: [
      {
        id: 'ugt6_1',
        text: 'Прототип содержит все детали системы',
        category: 'technical',
        description:
          'Собран полнофункциональный прототип системы, включающий все конструктивные элементы, электронные компоненты и программное обеспечение в конфигурации, максимально приближённой к серийному образцу. Отсутствуют «лабораторные» упрощения и временные решения.',
      },
      {
        id: 'ugt6_2',
        text: 'Демонстрация в релевантном окружении проведена',
        category: 'technical',
        description:
          'Проведена успешная демонстрация работы прототипа в условиях, адекватных реальной эксплуатации: с учётом температурного режима, влажности, вибрационных нагрузок, электромагнитных помех и других факторов целевой среды применения.',
      },
      {
        id: 'ugt6_3',
        text: 'Продемонстрирована работоспособность',
        category: 'technical',
        description:
          'В ходе демонстрационных испытаний подтверждена способность системы выполнять все заявленные функции в соответствии с техническими требованиями. Работоспособность подтверждена объективными измерениями и зафиксирована в акте демонстрации.',
      },
      {
        id: 'ugt6_4',
        text: 'Подтверждены ключевые функции системы',
        category: 'technical',
        description:
          'Каждая ключевая функция системы проверена в составе комплексных испытаний. Получены количественные оценки производительности, точности, надёжности и других критических параметров, подтверждающие соответствие требованиям спецификации.',
      },
      {
        id: 'ugt6_5',
        text: 'Демонстрационный отчёт подготовлен',
        category: 'organizational',
        description:
          'Оформлен отчёт о проведении демонстрационных испытаний, включающий описание условий проведения, методики контроля, полученные результаты с графиками и таблицами, а также выводы о готовности системы к следующему этапу — полевым испытаниям.',
      },
      {
        id: 'ugt6_6',
        text: 'Документация прототипа оформлена',
        category: 'organizational',
        description:
          'Подготовлен полный комплект технической документации на прототип, включая пояснительную записку, принципиальные схемы, спецификации, руководство по эксплуатации, программу и методику испытаний. Документация прошла технический контроль.',
      },
    ],
  },
  {
    levelId: 7,
    items: [
      {
        id: 'ugt7_1',
        text: 'Прототип испытан в полевых условиях',
        category: 'technical',
        description:
          'Проведены испытания прототипа в реальных условиях эксплуатации на объекте заказчика или на полигоне, максимально приближённом к условиям реального применения. Собрана статистика работы системы в течение установленного периода эксплуатации.',
      },
      {
        id: 'ugt7_2',
        text: 'Демонстрация в эксплуатационной среде проведена',
        category: 'technical',
        description:
          'Выполнена успешная демонстрация работы системы в присутствии представителей заказчика и/или эксплуатационного персонала. Демонстрация подтвердила выполнение всех функциональных требований в условиях, идентичных эксплуатационным.',
      },
      {
        id: 'ugt7_3',
        text: 'Успешные полевые испытания подтверждены',
        category: 'technical',
        description:
          'По результатам полевых испытаний подготовлен акт, подтверждающий успешное прохождение всех этапов тестирования. Выявленные замечания устранены, система готова к проведению квалификационных испытаний.',
      },
      {
        id: 'ugt7_4',
        text: 'Готов к мелкосерийному производству',
        category: 'production',
        description:
          'Выполнены все подготовительные работы для запуска мелкосерийного производства (LRIP): подготовлена технологическая документация, обучен персонал, квалифицированы поставщики комплектующих, развёрнута система контроля качества.',
      },
      {
        id: 'ugt7_5',
        text: 'Протоколы полевых тестов оформлены',
        category: 'organizational',
        description:
          'Оформлены протоколы полевых испытаний установленной формы, включающие дату и место проведения, состав комиссии, перечень проведённых проверок, измеренные значения параметров, выявленные отклонения и заключение комиссии о результатах испытаний.',
      },
      {
        id: 'ugt7_6',
        text: 'Акт готовности оформлен',
        category: 'organizational',
        description:
          'Подготовлен и подписан акт готовности технологии к переходу на этап квалификации и мелкосерийного производства. Акт утверждён руководством организации-разработчика и согласован с заказчиком.',
      },
    ],
  },
  {
    levelId: 8,
    items: [
      {
        id: 'ugt8_1',
        text: 'Система квалифицирована после испытаний',
        category: 'technical',
        description:
          'Система успешно прошла полный комплекс квалификационных испытаний, включающий функциональные, климатические, механические, электромагнитные и специальные проверки. Получено положительное заключение комиссии о соответствии системы требованиям спецификации.',
      },
      {
        id: 'ugt8_2',
        text: 'Соответствие спецификации подтверждено',
        category: 'technical',
        description:
          'Проведено сопоставление фактических технических характеристик системы с требованиями технической спецификации по всем контролируемым параметрам. Подтверждено соответствие по каждому пункту спецификации, оформлен сертификат соответствия.',
      },
      {
        id: 'ugt8_3',
        text: 'DT&E завершены',
        category: 'organizational',
        description:
          'Завершены работы по разработке, испытанию и оценке (Development, Test & Evaluation). Выполнены все этапы проектирования, изготовления опытных образцов, проведены предварительные и квалификационные испытания, оформлена отчётность.',
      },
      {
        id: 'ugt8_4',
        text: 'Пилотная линия работает',
        category: 'production',
        description:
          'Развёрнута и прошла опытную эксплуатацию пилотная производственная линия, позволяющая изготавливать продукцию в соответствии с технологическим регламентом. Выпущена опытная партия, подтвердившая работоспособность технологического процесса.',
      },
      {
        id: 'ugt8_5',
        text: 'Документация под контролем конфигурации',
        category: 'organizational',
        description:
          'Внедрена система управления конфигурацией, обеспечивающая учёт всех изменений в технической документации. Установлен порядок внесения изменений, версионирования и распространения документов среди всех участников проекта.',
      },
      {
        id: 'ugt8_6',
        text: 'Производственные процессы на LRIP налажены',
        category: 'production',
        description:
          'Производственные процессы мелкосерийного выпуска отлажены и стабильно обеспечивают выпуск продукции с заданными характеристиками. Разработаны технологические карты, инструкции по сборке и контролю, обеспечена повторяемость результатов.',
      },
      {
        id: 'ugt8_7',
        text: 'Поставщики квалифицированы',
        category: 'production',
        description:
          'Проведён аудит и квалификация всех ключевых поставщиков комплектующих и материалов. Поставщики подтвердили свою способность обеспечивать требуемое качество продукции в установленные сроки и в нужных объёмах.',
      },
      {
        id: 'ugt8_8',
        text: 'Сертификация ПО получена',
        category: 'technical',
        description:
          'Программное обеспечение системы прошло сертификацию в соответствии с установленными требованиями (ФСТЭК, ФСБ или отраслевые стандарты). Получены необходимые сертификаты соответствия, подтверждающие безопасность и надёжность ПО.',
      },
    ],
  },
  {
    levelId: 9,
    items: [
      {
        id: 'ugt9_1',
        text: 'Система в успешной эксплуатации',
        category: 'technical',
        description:
          'Система установлена и успешно эксплуатируется на объектах заказчика в течение установленного гарантийного срока. Накоплена положительная эксплуатационная статистика, подтверждающая надёжность, эффективность и безопасность применения технологии.',
      },
      {
        id: 'ugt9_2',
        text: 'OT&E завершены',
        category: 'organizational',
        description:
          'Завершены эксплуатационные испытания и оценка (Operational Test & Evaluation), проводимые реальными пользователями в эксплуатационных условиях. Получено подтверждение готовности системы к массовому внедрению и положительные отзывы эксплуатационного персонала.',
      },
      {
        id: 'ugt9_3',
        text: 'Концепция использования реализована',
        category: 'technical',
        description:
          'В полном объёме реализованы все элементы концепции применения системы, включая интеграцию с существующей инфраструктурой, обучение персонала, подготовку эксплуатационной документации и обеспечение технической поддержки пользователей.',
      },
      {
        id: 'ugt9_4',
        text: 'Производство стабильное (6-сигма)',
        category: 'production',
        description:
          'Производственный процесс достиг уровня зрелости Six Sigma: дефектность не превышает 3,4 дефекта на миллион операций, процессы статистически управляемы и предсказуемы. Внедрена система непрерывного улучшения производственных показателей.',
      },
      {
        id: 'ugt9_5',
        text: 'Целевая стоимость достигнута',
        category: 'production',
        description:
          'В результате оптимизации производственных процессов, снижения себестоимости материалов, автоматизации операций и повышения выхода годной продукции достигнута целевая себестоимость единицы продукции, подтверждённая экономическим расчётом.',
      },
      {
        id: 'ugt9_6',
        text: 'План обучения реализован',
        category: 'organizational',
        description:
          'Разработан и реализован комплексный план подготовки и обучения эксплуатационного персонала, включающий теоретические курсы, практические занятия, учебные материалы и систему аттестации. Весь персонал прошёл обучение и аттестован на допуск к работе с системой.',
      },
      {
        id: 'ugt9_7',
        text: 'План поддержки реализован',
        category: 'organizational',
        description:
          'Создана и функционирует система технической поддержки на этапе эксплуатации: служба Help Desk, удалённая диагностика, сервисная служба с выездом на объект, система управления заявками. Обеспечен оперативный ремонт и поставка запасных частей.',
      },
      {
        id: 'ugt9_8',
        text: 'Вся документация завершена',
        category: 'organizational',
        description:
          'Подготовлен полный комплект эксплуатационной документации: руководство по эксплуатации, инструкции по техническому обслуживанию и ремонту, каталог запасных частей, программа и методика приёмо-сдаточных испытаний. Документация передана заказчику и утверждена.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Technology categories                                               */
/* ------------------------------------------------------------------ */
const TECH_CATEGORIES = [
  'Программное обеспечение',
  'Аппаратные средства',
  'Информационные системы',
  'Промышленные технологии',
  'Биотехнологии',
  'Энергетические технологии',
  'Материаловедение',
  'Робототехника',
  'Другое',
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                  */
/* ------------------------------------------------------------------ */
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as [number, number, number, number];
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as [number, number, number, number];
const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (d: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: d, ease: EASE_OUT_EXPO },
  }),
};

const stepTransition = {
  enter: (dir: number) => ({ x: dir > 0 ? 30 : -30, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: EASE_SMOOTH } },
  exit: (dir: number) => ({
    x: dir > 0 ? -30 : 30,
    opacity: 0,
    transition: { duration: 0.25, ease: EASE_SMOOTH },
  }),
};

/* ------------------------------------------------------------------ */
/*  Helper: get level color                                            */
/* ------------------------------------------------------------------ */
function getLevelColor(levelId: number): string {
  return UGT_LEVELS[levelId - 1]?.color ?? '#2E5BFF';
}

/* ------------------------------------------------------------------ */
/*  Component: Circular Progress                                        */
/* ------------------------------------------------------------------ */
function CircularProgress({
  percentage,
  color,
  size = 180,
  label,
  sublabel,
}: {
  percentage: number;
  color: string;
  size?: number;
  label: string;
  sublabel: string;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percentage / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8ECF0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <motion.span
          className="font-mono text-4xl font-bold"
          style={{ color }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, ease: EASE_BOUNCE, delay: 0.5 }}
        >
          {label}
        </motion.span>
        <span className="mt-1 max-w-[120px] text-xs leading-tight" style={{ color: '#475569' }}>
          {sublabel}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component: Category Badge                                           */
/* ------------------------------------------------------------------ */
function CategoryBadge({ category }: { category: keyof typeof CATEGORY_CONFIG }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: `${cfg.color}18`,
        color: cfg.color,
        boxShadow: `0 1px 4px ${cfg.color}15`,
      }}
    >
      <cfg.icon size={11} />
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Component: Checklist Item Card with expandable description          */
/* ------------------------------------------------------------------ */
function ChecklistItemCard({
  item,
  isChecked,
  isExpanded,
  levelColor,
  onToggleCheck,
  onToggleExpand,
  index,
}: {
  item: ChecklistItem;
  isChecked: boolean;
  isExpanded: boolean;
  levelColor: string;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  index: number;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.35,
        delay: index * 0.05,
        ease: EASE_OUT_EXPO,
        layout: { duration: 0.3, ease: EASE_SMOOTH },
      }}
      className="group cursor-pointer select-none overflow-hidden rounded-2xl border bg-white transition-all duration-200"
      style={{
        borderColor: isChecked ? `${levelColor}40` : '#E8ECF0',
        borderLeftWidth: isChecked ? 3 : 1,
        borderLeftColor: isChecked ? levelColor : '#E8ECF0',
        background: isChecked ? `${levelColor}05` : '#FFFFFF',
        boxShadow: isChecked
          ? `0 4px 20px ${levelColor}12, 0 1px 4px rgba(15,23,42,0.06)`
          : '0 2px 8px rgba(15,23,42,0.04)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = isChecked
          ? `0 8px 28px ${levelColor}1A, 0 4px 12px rgba(15,23,42,0.08)`
          : '0 8px 28px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = isChecked
          ? `0 4px 20px ${levelColor}12, 0 1px 4px rgba(15,23,42,0.06)`
          : '0 2px 8px rgba(15,23,42,0.04)';
      }}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-4 p-5 sm:p-6"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck();
        }}
      >
        {/* Checkbox */}
        <motion.div
          className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2"
          style={{
            borderColor: isChecked ? levelColor : '#DEE2E8',
            background: isChecked ? levelColor : 'transparent',
          }}
          animate={
            isChecked
              ? { scale: [1, 1.15, 1.05] }
              : { scale: 1 }
          }
          transition={{ duration: 0.3, ease: EASE_BOUNCE }}
        >
          {isChecked && (
            <Check size={14} className="text-white" strokeWidth={3} />
          )}
        </motion.div>

        {/* Content */}
        <div className="flex-1">
          <p
            className="text-base font-medium leading-snug"
            style={{ color: '#0F172A' }}
          >
            {item.text}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <CategoryBadge category={item.category} />
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <div
        className="flex items-center justify-center border-t px-5 py-2 transition-colors duration-150"
        style={{
          borderColor: isExpanded ? `${levelColor}18` : 'transparent',
          background: isExpanded ? `${levelColor}04` : 'transparent',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        <button
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-all duration-200 hover:underline"
          style={{
            color: isExpanded ? levelColor : '#94A3B8',
            textUnderlineOffset: 3,
            textDecorationColor: isExpanded ? levelColor : '#94A3B8',
          }}
        >
          <Info size={12} />
          {isExpanded ? 'Скрыть' : 'Подробнее'}
          {isExpanded ? (
            <ChevronUp size={12} className="transition-transform duration-200" />
          ) : (
            <ChevronDown size={12} className="transition-transform duration-200" />
          )}
        </button>
      </div>

      {/* Expandable description */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_SMOOTH }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="mx-5 mb-4 rounded-xl px-4 py-3.5 sm:mx-6 sm:px-5 sm:py-4"
              style={{
                borderLeft: `3px solid ${levelColor}`,
                background: `${levelColor}08`,
              }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#475569' }}
              >
                {item.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Assessment Page                                                */
/* ------------------------------------------------------------------ */
export default function Assessment() {
  const navigate = useNavigate();

  /* -- Wizard state -- */
  const [currentStep, setCurrentStep] = useState<WizardStep>('info');
  const [direction, setDirection] = useState(1);

  /* -- Project info -- */
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    name: '',
    description: '',
    category: '',
    targetLevel: 9,
  });

  /* -- Selections: Map<levelId, Set<itemId>> -- */
  const [selections, setSelections] = useState<Map<number, Set<string>>>(new Map());

  /* -- Expanded items: Set<itemId> -- */
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  /* -- Active category tab per step -- */
  const [activeCategory, setActiveCategory] = useState<string>('all');

  /* -- Result view toggle: 'bars' | 'radar' -- */
  const [chartView, setChartView] = useState<'bars' | 'radar'>('bars');

  /* ---------------------------------------------------------------- */
  /*  Callbacks                                                       */
  /* ---------------------------------------------------------------- */
  const currentLevel = useMemo(() => {
    if (typeof currentStep === 'number') return UGT_LEVELS[currentStep];
    return null;
  }, [currentStep]);

  const currentChecklist = useMemo(() => {
    if (typeof currentStep === 'number') return STEP_CHECKLISTS[currentStep];
    return null;
  }, [currentStep]);

  const currentSelections = useMemo(() => {
    if (!currentLevel) return new Set<string>();
    return selections.get(currentLevel.id) ?? new Set<string>();
  }, [selections, currentLevel]);

  const categoriesInCurrentStep = useMemo(() => {
    if (!currentChecklist) return [];
    const cats = new Set<string>();
    currentChecklist.items.forEach((i) => cats.add(i.category));
    return Array.from(cats);
  }, [currentChecklist]);

  const filteredItems = useMemo(() => {
    if (!currentChecklist) return [];
    if (activeCategory === 'all') return currentChecklist.items;
    return currentChecklist.items.filter((i) => i.category === activeCategory);
  }, [currentChecklist, activeCategory]);

  const toggleItem = useCallback(
    (levelId: number, itemId: string) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(levelId) ?? []);
        if (set.has(itemId)) set.delete(itemId);
        else set.add(itemId);
        next.set(levelId, set);
        return next;
      });
    },
    []
  );

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    if (currentStep === 'info') setCurrentStep(0);
    else if (typeof currentStep === 'number') {
      if (currentStep < 8) setCurrentStep(currentStep + 1);
      else setCurrentStep('results');
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    setDirection(-1);
    if (currentStep === 'results') setCurrentStep(8);
    else if (typeof currentStep === 'number') {
      if (currentStep > 0) setCurrentStep(currentStep - 1);
      else setCurrentStep('info');
    }
  }, [currentStep]);

  const skipStep = useCallback(() => {
    setDirection(1);
    if (typeof currentStep === 'number') {
      if (currentStep < 8) setCurrentStep(currentStep + 1);
      else setCurrentStep('results');
    }
  }, [currentStep]);

  const resetAssessment = useCallback(() => {
    setSelections(new Map());
    setExpandedItems(new Set());
    setProjectInfo({ name: '', description: '', category: '', targetLevel: 9 });
    setCurrentStep('info');
    setDirection(1);
    setActiveCategory('all');
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Results computation                                              */
  /* ---------------------------------------------------------------- */
  const results = useMemo(() => {
    const levelScores = STEP_CHECKLISTS.map((step) => {
      const checked = selections.get(step.levelId) ?? new Set<string>();
      const total = step.items.length;
      const pct = Math.round((checked.size / total) * 100);
      const achieved = pct >= 70;
      return {
        levelId: step.levelId,
        level: UGT_LEVELS[step.levelId - 1],
        checked: checked.size,
        total,
        percentage: pct,
        achieved,
      };
    });

    /* Highest consecutive achieved level */
    let determinedLevel = 0;
    for (let i = 0; i < levelScores.length; i++) {
      if (levelScores[i].achieved) determinedLevel = levelScores[i].levelId;
      else break;
    }

    /* Cannot skip: if level N not achieved but N+1 is, still N */
    for (let i = 0; i < determinedLevel; i++) {
      if (!levelScores[i].achieved) {
        determinedLevel = i;
        break;
      }
    }

    const overallPct =
      levelScores.reduce((sum, s) => sum + s.percentage, 0) / levelScores.length;

    return { levelScores, determinedLevel, overallPct };
  }, [selections]);

  /* ---------------------------------------------------------------- */
  /*  Progress for stepper                                             */
  /* ---------------------------------------------------------------- */
  const totalSteps = 9;
  const completedSteps = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= 9; i++) {
      const checked = selections.get(i);
      if (checked && checked.size > 0) count++;
    }
    return currentStep === 'results' ? 9 : currentStep === 'info' ? 0 : (currentStep as number) + 1;
  }, [selections, currentStep]);

  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  /* ---------------------------------------------------------------- */
  /*  Radar / Bar chart data                                           */
  /* ---------------------------------------------------------------- */
  const radarData = useMemo(
    () =>
      results.levelScores.map((s) => ({
        subject: s.level.code,
        fullMark: 100,
        pct: s.percentage,
        color: s.level.color,
      })),
    [results]
  );

  const barData = useMemo(
    () =>
      results.levelScores.map((s) => ({
        name: s.level.code,
        pct: s.percentage,
        color: s.level.color,
        achieved: s.achieved,
      })),
    [results]
  );

  /* ---------------------------------------------------------------- */
  /*  Derived: recommendations for next level                          */
  /* ---------------------------------------------------------------- */
  const nextLevelRecommendations = useMemo(() => {
    const nextId = results.determinedLevel + 1;
    if (nextId > 9) return [];
    const step = STEP_CHECKLISTS[nextId - 1];
    const checked = selections.get(nextId) ?? new Set<string>();
    return step.items.filter((i) => !checked.has(i.id));
  }, [results.determinedLevel, selections]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: '#0F172A', paddingTop: 120, paddingBottom: 48 }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <motion.p
            className="mb-4 text-sm"
            style={{ color: '#94A3B8' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            Главная → Оценка проекта
          </motion.p>

          {/* Title */}
          <motion.h1
            className="text-4xl font-bold text-white sm:text-5xl lg:text-[56px]"
            style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT_EXPO }}
          >
            Оценка уровня готовности технологии
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mt-4 max-w-[600px] text-lg"
            style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: EASE_OUT_EXPO }}
          >
            Ответьте на вопросы по критериям ГОСТ Р 58048-2017, и система определит текущий УГТ вашего проекта
          </motion.p>

          {/* Stepper */}
          <motion.div
            className="glass-dark mt-10 max-w-[800px] rounded-2xl px-6 py-5 sm:px-8"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.7, ease: EASE_OUT_EXPO }}
          >
            {/* Step circles */}
            <div className="flex items-center justify-between gap-1">
              {UGT_LEVELS.map((level, idx) => {
                const isCompleted =
                  currentStep === 'results'
                    ? true
                    : typeof currentStep === 'number'
                      ? idx < currentStep
                      : false;
                const isCurrent =
                  currentStep !== 'results' &&
                  currentStep !== 'info' &&
                  idx === (currentStep as number);
                const isUpcoming = !isCompleted && !isCurrent;

                return (
                  <div key={level.id} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-2">
                      <motion.div
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 40,
                          height: 40,
                          background: isCompleted
                            ? '#10B981'
                            : isCurrent
                              ? level.color
                              : 'rgba(255,255,255,0.08)',
                          border: isUpcoming
                            ? '2px solid rgba(255,255,255,0.15)'
                            : 'none',
                          boxShadow: isCurrent
                            ? `0 0 0 4px ${level.color}33`
                            : 'none',
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.8 + idx * 0.06,
                          ease: EASE_BOUNCE,
                        }}
                      >
                        {isCompleted ? (
                          <Check size={18} className="text-white" strokeWidth={3} />
                        ) : (
                          <span
                            className="text-sm font-bold"
                            style={{
                              color: isCurrent
                                ? '#FFFFFF'
                                : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            {level.id}
                          </span>
                        )}
                      </motion.div>
                      <span
                        className="hidden font-mono text-[10px] font-medium sm:block"
                        style={{ color: '#94A3B8' }}
                      >
                        {level.code}
                      </span>
                    </div>
                    {idx < 8 && (
                      <div
                        className="mx-1 hidden h-[2px] flex-1 sm:block"
                        style={{
                          background:
                            isCompleted &&
                            (currentStep === 'results' ||
                              (typeof currentStep === 'number' && idx < currentStep))
                              ? '#10B981'
                              : isCurrent
                                ? `repeating-linear-gradient(90deg, ${level.color} 0, ${level.color} 4px, transparent 4px, transparent 8px)`
                                : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall progress */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Прогресс: {progressPercent}% ({Math.min(completedSteps, 9)}/9)
                </span>
              </div>
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: '#4A82FF' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ WIZARD BODY ═══════════════ */}
      <section style={{ background: '#F5F7FA', padding: '64px 0' }}>
        <div className="mx-auto max-w-[900px] px-4 sm:px-6">
          <AnimatePresence mode="wait" custom={direction}>
            {/* ── Project Info Form ── */}
            {currentStep === 'info' && (
              <motion.div
                key="info"
                custom={direction}
                variants={stepTransition}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="mb-8">
                  <div
                    className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
                    style={{
                      background: 'rgba(46,91,255,0.1)',
                      color: '#2E5BFF',
                      border: '1px solid rgba(46,91,255,0.3)',
                    }}
                  >
                    <FileText size={14} />
                    Информация о проекте
                  </div>
                  <h2
                    className="text-2xl font-bold sm:text-[32px]"
                    style={{ color: '#0F172A', lineHeight: 1.2 }}
                  >
                    Расскажите о вашем проекте
                  </h2>
                  <p className="mt-2 text-base" style={{ color: '#475569' }}>
                    Эта информация поможет персонализировать результаты оценки
                  </p>
                </div>

                <div
                  className="rounded-2xl p-6 sm:p-8"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E8ECF0',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
                  }}
                >
                  <div className="space-y-6">
                    {/* Project name */}
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium"
                        style={{ color: '#0F172A' }}
                      >
                        Название проекта
                      </label>
                      <input
                        type="text"
                        value={projectInfo.name}
                        onChange={(e) =>
                          setProjectInfo((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Например: Система автоматического контроля качества"
                        className="w-full rounded-[10px] border px-4 py-3 text-sm outline-none transition-colors focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20"
                        style={{ borderColor: '#DEE2E8', background: '#FFFFFF' }}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium"
                        style={{ color: '#0F172A' }}
                      >
                        Описание проекта
                      </label>
                      <textarea
                        value={projectInfo.description}
                        onChange={(e) =>
                          setProjectInfo((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Краткое описание технологии и целей проекта"
                        rows={4}
                        className="w-full resize-none rounded-[10px] border px-4 py-3 text-sm outline-none transition-colors focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20"
                        style={{ borderColor: '#DEE2E8', background: '#FFFFFF' }}
                      />
                    </div>

                    {/* Category + Target Level */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          className="mb-2 block text-sm font-medium"
                          style={{ color: '#0F172A' }}
                        >
                          Категория технологии
                        </label>
                        <select
                          value={projectInfo.category}
                          onChange={(e) =>
                            setProjectInfo((p) => ({
                              ...p,
                              category: e.target.value,
                            }))
                          }
                          className="w-full rounded-[10px] border px-4 py-3 text-sm outline-none transition-colors focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20"
                          style={{
                            borderColor: '#DEE2E8',
                            background: '#FFFFFF',
                            color: projectInfo.category ? '#0F172A' : '#94A3B8',
                          }}
                        >
                          <option value="" disabled>
                            Выберите категорию
                          </option>
                          {TECH_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          className="mb-2 block text-sm font-medium"
                          style={{ color: '#0F172A' }}
                        >
                          Целевой уровень УГТ
                        </label>
                        <select
                          value={projectInfo.targetLevel}
                          onChange={(e) =>
                            setProjectInfo((p) => ({
                              ...p,
                              targetLevel: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded-[10px] border px-4 py-3 text-sm outline-none transition-colors focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20"
                          style={{ borderColor: '#DEE2E8', background: '#FFFFFF' }}
                        >
                          {UGT_LEVELS.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code} — {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={goNext}
                      className="gradient-cool inline-flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
                    >
                      Начать оценку
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── UGT Step (checklist) ── */}
            {typeof currentStep === 'number' && currentLevel && currentChecklist && (
              <motion.div
                key={`step-${currentStep}`}
                custom={direction}
                variants={stepTransition}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Step header — Glassmorphism style */}
                <motion.div
                  className="mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={0}
                  style={{
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: `${currentLevel.color}25`,
                    boxShadow: `0 4px 24px ${currentLevel.color}10, 0 1px 3px rgba(15,23,42,0.06)`,
                  }}
                >
                  <div
                    className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-sm font-semibold"
                    style={{
                      background: `${currentLevel.color}15`,
                      color: currentLevel.color,
                      border: `1px solid ${currentLevel.color}30`,
                      boxShadow: `0 1px 4px ${currentLevel.color}15`,
                    }}
                  >
                    {currentLevel.code}
                  </div>
                  <h2
                    className="text-2xl font-bold sm:text-[32px]"
                    style={{ color: '#0F172A', lineHeight: 1.2 }}
                  >
                    {currentLevel.name}
                  </h2>
                  <p className="mt-2 text-base" style={{ color: '#475569' }}>
                    {currentLevel.short}
                  </p>
                  <div
                    className="mt-4 flex items-center gap-2 text-sm"
                    style={{ color: '#94A3B8' }}
                  >
                    <HelpCircle size={16} />
                    Отметьте пункты, которые выполнены для вашего проекта
                  </div>
                </motion.div>

                {/* Category tabs */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className="rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200"
                    style={{
                      background: activeCategory === 'all' ? '#FFFFFF' : 'transparent',
                      color: activeCategory === 'all' ? '#0F172A' : '#94A3B8',
                      boxShadow:
                        activeCategory === 'all'
                          ? '0 2px 8px rgba(15,23,42,0.08)'
                          : 'none',
                    }}
                  >
                    Все
                  </button>
                  {categoriesInCurrentStep.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200"
                        style={{
                          background: activeCategory === cat ? '#FFFFFF' : 'transparent',
                          color: activeCategory === cat ? cfg.color : '#94A3B8',
                          boxShadow:
                            activeCategory === cat
                              ? '0 2px 8px rgba(15,23,42,0.08)'
                              : 'none',
                        }}
                      >
                        <cfg.icon size={14} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                {/* Checklist */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map((item, idx) => (
                      <ChecklistItemCard
                        key={item.id}
                        item={item}
                        isChecked={currentSelections.has(item.id)}
                        isExpanded={expandedItems.has(item.id)}
                        levelColor={currentLevel.color}
                        onToggleCheck={() => toggleItem(currentLevel.id, item.id)}
                        onToggleExpand={() => toggleExpand(item.id)}
                        index={idx}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Progress for current step */}
                <div
                  className="mt-6 rounded-2xl bg-white p-4 sm:p-5"
                  style={{
                    border: '1px solid #E8ECF0',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#475569' }}>
                      Выполнено: {currentSelections.size}/{currentChecklist.items.length}
                    </span>
                    <span
                      className="font-mono text-xl font-semibold"
                      style={{ color: currentLevel.color }}
                    >
                      {Math.round(
                        (currentSelections.size / currentChecklist.items.length) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: '#E8ECF0' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: currentLevel.color }}
                      animate={{
                        width: `${(currentSelections.size / currentChecklist.items.length) * 100}%`,
                      }}
                      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                    />
                  </div>
                </div>

                {/* Navigation buttons */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={goBack}
                    className="inline-flex items-center justify-center gap-2 rounded-[10px] border px-5 py-3 text-sm font-medium transition-all duration-200 hover:bg-[#EEF1F5]"
                    style={{ borderColor: '#DEE2E8', color: '#0F172A' }}
                  >
                    <ChevronLeft size={16} />
                    Назад
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={skipStep}
                      className="inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-medium transition-all duration-200 hover:bg-[#2E5BFF]/5"
                      style={{ color: '#2E5BFF' }}
                    >
                      Пропустить уровень
                    </button>

                    <button
                      onClick={goNext}
                      className="inline-flex items-center justify-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
                      style={{ background: currentLevel.color }}
                    >
                      {currentStep === 8 ? (
                        <>
                          Завершить оценку
                          <Check size={16} />
                        </>
                      ) : (
                        <>
                          Далее
                          <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Results Dashboard ── */}
            {currentStep === 'results' && (
              <motion.div
                key="results"
                custom={direction}
                variants={stepTransition}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Result Header */}
                <motion.div
                  className="mb-10 text-center"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                >
                  <span
                    className="mb-3 inline-block text-xs font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#94A3B8' }}
                  >
                    РЕЗУЛЬТАТЫ ОЦЕНКИ
                  </span>
                  <h2
                    className="text-3xl font-bold sm:text-[40px]"
                    style={{ color: '#0F172A', lineHeight: 1.15 }}
                  >
                    Уровень готовности вашего проекта
                  </h2>
                </motion.div>

                {/* Main Result Card */}
                <motion.div
                  className="relative mx-auto max-w-[700px] overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl sm:p-12"
                  style={{
                    border: `2px solid ${getLevelColor(results.determinedLevel)}`,
                    boxShadow: `0 16px 40px rgba(15,23,42,0.08), 0 0 40px ${getLevelColor(results.determinedLevel)}18`,
                  }}
                  initial={{ opacity: 0, y: 40, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
                >
                  {/* Circular badge */}
                  <div className="flex justify-center">
                    <CircularProgress
                      percentage={
                        results.determinedLevel > 0
                          ? results.levelScores[results.determinedLevel - 1].percentage
                          : 0
                      }
                      color={getLevelColor(results.determinedLevel)}
                      size={180}
                      label={
                        results.determinedLevel > 0
                          ? `УГТ ${results.determinedLevel}`
                          : '—'
                      }
                      sublabel={
                        results.determinedLevel > 0
                          ? UGT_LEVELS[results.determinedLevel - 1].name
                          : 'Не определён'
                      }
                    />
                  </div>

                  {/* Progress text */}
                  <motion.div
                    className="mt-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <p
                      className="font-mono text-xl font-medium"
                      style={{ color: '#0F172A' }}
                    >
                      {results.determinedLevel > 0
                        ? `${results.levelScores[results.determinedLevel - 1].percentage}% критериев выполнено`
                        : 'Недостаточно данных'}
                    </p>
                    {results.determinedLevel > 0 && (
                      <p className="mt-1 text-sm" style={{ color: '#475569' }}>
                        (
                        {
                          results.levelScores[results.determinedLevel - 1]
                            .checked
                        }{' '}
                        из{' '}
                        {
                          results.levelScores[results.determinedLevel - 1]
                            .total
                        }{' '}
                        критериев)
                      </p>
                    )}
                  </motion.div>

                  {/* Description */}
                  <motion.p
                    className="mx-auto mt-4 max-w-[500px] text-base"
                    style={{ color: '#475569', lineHeight: 1.65 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    {results.determinedLevel > 0
                      ? `Ваш проект находится на этапе «${UGT_LEVELS[results.determinedLevel - 1].name}». ${UGT_LEVELS[results.determinedLevel - 1].description}`
                      : 'Для определения уровня УГТ необходимо выполнить не менее 70% критериев хотя бы одного уровня. Рекомендуем пройти оценку заново и отметить больше выполненных пунктов.'}
                  </motion.p>

                  {/* CTA row */}
                  <motion.div
                    className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                  >
                    {results.determinedLevel > 0 && (
                      <button
                        onClick={() =>
                          navigate(`/level/${results.determinedLevel}`)
                        }
                        className="gradient-cool inline-flex items-center gap-2 rounded-[10px] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:shadow-lg"
                      >
                        Просмотреть детали УГТ {results.determinedLevel}
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        navigate(`/roadmap?current=${results.determinedLevel}`)
                      }
                      className="inline-flex items-center gap-2 rounded-[10px] border px-6 py-3.5 text-sm font-medium transition-all hover:bg-[#EEF1F5]"
                      style={{ borderColor: '#DEE2E8', color: '#0F172A' }}
                    >
                      <MapIcon size={16} />
                      Построить дорожную карту
                    </button>
                    <button
                      onClick={resetAssessment}
                      className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3.5 text-sm font-medium transition-all hover:bg-[#2E5BFF]/5"
                      style={{ color: '#2E5BFF' }}
                    >
                      <RotateCcw size={16} />
                      Пройти заново
                    </button>
                  </motion.div>
                </motion.div>

                {/* Chart Section */}
                <motion.div
                  className="mt-16"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6, ease: EASE_OUT_EXPO }}
                >
                  <h3
                    className="mb-6 text-center text-2xl font-bold"
                    style={{ color: '#0F172A' }}
                  >
                    Детализация по уровням
                  </h3>

                  {/* Chart toggle */}
                  <div className="mb-6 flex justify-center">
                    <div
                      className="inline-flex rounded-xl p-1"
                      style={{ background: '#EEF1F5' }}
                    >
                      <button
                        onClick={() => setChartView('bars')}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
                        style={{
                          background: chartView === 'bars' ? '#FFFFFF' : 'transparent',
                          color: chartView === 'bars' ? '#0F172A' : '#94A3B8',
                          boxShadow: chartView === 'bars' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                        }}
                      >
                        Гистограмма
                      </button>
                      <button
                        onClick={() => setChartView('radar')}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
                        style={{
                          background: chartView === 'radar' ? '#FFFFFF' : 'transparent',
                          color: chartView === 'radar' ? '#0F172A' : '#94A3B8',
                          boxShadow: chartView === 'radar' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                        }}
                      >
                        Радар
                      </button>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  {chartView === 'bars' && (
                    <div
                      className="rounded-2xl bg-white p-4 shadow-md sm:p-6"
                      style={{ border: '1px solid #E8ECF0' }}
                    >
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={barData}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal
                            vertical={false}
                            stroke="#E8ECF0"
                          />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 12, fill: '#94A3B8' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 12, fill: '#475569', fontFamily: 'JetBrains Mono' }}
                            width={60}
                          />
                          <Tooltip
                            formatter={(value: number) => [`${value}%`, 'Выполнено']}
                            contentStyle={{
                              borderRadius: 10,
                              border: '1px solid #E8ECF0',
                              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                            }}
                          />
                          <ReferenceLine
                            x={70}
                            stroke="#EF4444"
                            strokeDasharray="6 3"
                            label={{
                              value: 'Порог 70%',
                              position: 'top',
                              fill: '#EF4444',
                              fontSize: 11,
                            }}
                          />
                          <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={22}>
                            {barData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Radar Chart */}
                  {chartView === 'radar' && (
                    <div
                      className="rounded-2xl bg-white p-4 shadow-md sm:p-6"
                      style={{ border: '1px solid #E8ECF0' }}
                    >
                      <ResponsiveContainer width="100%" height={450}>
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="#E8ECF0" />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 12, fill: '#475569', fontFamily: 'JetBrains Mono' }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Radar
                            name="Выполнено"
                            dataKey="pct"
                            stroke={getLevelColor(results.determinedLevel)}
                            strokeWidth={2.5}
                            fill={getLevelColor(results.determinedLevel)}
                            fillOpacity={0.2}
                          />
                          <Tooltip
                            formatter={(value: number) => [`${value}%`, 'Выполнено']}
                            contentStyle={{
                              borderRadius: 10,
                              border: '1px solid #E8ECF0',
                              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </motion.div>

                {/* Level-by-level breakdown cards */}
                <motion.div
                  className="mt-12"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.6, ease: EASE_OUT_EXPO }}
                >
                  <h3
                    className="mb-6 text-center text-2xl font-bold"
                    style={{ color: '#0F172A' }}
                  >
                    Результаты по уровням
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {results.levelScores.map((s, idx) => (
                      <motion.div
                        key={s.levelId}
                        className="rounded-2xl bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                        style={{
                          border: '1px solid',
                          borderColor: s.achieved
                            ? `${s.level.color}66`
                            : '#E8ECF0',
                          borderLeftWidth: s.achieved ? 3 : 1,
                          borderLeftColor: s.achieved
                            ? s.level.color
                            : '#E8ECF0',
                          boxShadow:
                            s.levelId === results.determinedLevel
                              ? `0 0 20px ${s.level.color}18`
                              : '0 2px 8px rgba(15,23,42,0.04)',
                        }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.8 + idx * 0.06,
                          duration: 0.4,
                          ease: EASE_OUT_EXPO,
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span
                            className="inline-block rounded-full px-3 py-1 font-mono text-xs font-semibold"
                            style={{
                              background: `${s.level.color}18`,
                              color: s.level.color,
                              boxShadow: `0 1px 4px ${s.level.color}15`,
                            }}
                          >
                            {s.level.code}
                          </span>
                          <span
                            className="font-mono text-xl font-semibold"
                            style={{ color: s.level.color }}
                          >
                            {s.percentage}%
                          </span>
                        </div>
                        <p
                          className="mb-2 text-sm font-medium"
                          style={{ color: '#0F172A' }}
                        >
                          {s.level.name}
                        </p>
                        <div
                          className="mb-2 h-1.5 w-full overflow-hidden rounded-full"
                          style={{ background: '#E8ECF0' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${s.percentage}%`,
                              background: s.level.color,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: '#94A3B8' }}>
                            {s.checked}/{s.total} критериев
                          </span>
                          <span
                            className="flex items-center gap-1 text-xs font-medium"
                            style={{
                              color: s.achieved ? '#10B981' : '#94A3B8',
                            }}
                          >
                            {s.achieved ? (
                              <>
                                <Check size={12} />
                                Достигнут
                              </>
                            ) : (
                              <>
                                <span className="h-2 w-2 rounded-full bg-current" />
                                Не достигнут
                              </>
                            )}
                          </span>
                        </div>
                        {s.levelId === results.determinedLevel && (
                          <div
                            className="mt-2 rounded-md px-2.5 py-1 text-center text-xs font-semibold"
                            style={{
                              background: `${s.level.color}18`,
                              color: s.level.color,
                            }}
                          >
                            ✓ Определён текущий уровень
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Recommendations Block */}
                <motion.div
                  className="mt-16 overflow-hidden rounded-2xl p-6 sm:p-10"
                  style={{ background: '#0F172A' }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.6, ease: EASE_OUT_EXPO }}
                >
                  <div className="mb-6 flex items-center gap-3">
                    <Lightbulb size={24} style={{ color: '#E5C840' }} />
                    <h3 className="text-xl font-bold text-white sm:text-2xl">
                      Рекомендации
                    </h3>
                  </div>

                  <div
                    className="space-y-4 text-base leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                  >
                    <p>
                      Ваш проект соответствует уровню{' '}
                      <strong style={{ color: getLevelColor(results.determinedLevel) }}>
                        УГТ {results.determinedLevel}
                        {results.determinedLevel > 0 &&
                          ` — ${UGT_LEVELS[results.determinedLevel - 1].name}`}
                      </strong>
                      .
                      {results.determinedLevel > 0 &&
                        results.determinedLevel < 9 && (
                          <>
                            {' '}Для дальнейшего развития сфокусируйтесь на переходе к УГТ{' '}
                            {results.determinedLevel + 1}.
                          </>
                        )}
                    </p>

                    {results.determinedLevel < 9 &&
                      nextLevelRecommendations.length > 0 && (
                      <div>
                        <p
                          className="mb-3 font-semibold"
                          style={{ color: 'rgba(255,255,255,0.95)' }}
                        >
                          Для перехода на УГТ {results.determinedLevel + 1} необходимо:
                        </p>
                        <ul className="space-y-2">
                          {nextLevelRecommendations.slice(0, 5).map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-3"
                            >
                              <span
                                className="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
                                style={{
                                  background: getLevelColor(
                                    results.determinedLevel + 1
                                  ),
                                }}
                              />
                              <span>{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {results.determinedLevel === 9 && (
                      <p>
                        Поздравляем! Ваш проект достиг максимального уровня
                        готовности технологии. Система находится в успешной
                        эксплуатации со стабильным производством.
                      </p>
                    )}

                    {results.determinedLevel === 0 && (
                      <p>
                        Рекомендуем начать с формализации научных принципов и
                        подготовки публикаций для достижения УГТ 1.
                      </p>
                    )}
                  </div>

                  {/* Recommendations CTA */}
                  <div className="mt-8">
                    <button
                      onClick={() =>
                        navigate(`/roadmap?current=${results.determinedLevel}`)
                      }
                      className="gradient-cool inline-flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.03] hover:shadow-lg"
                    >
                      Перейти к дорожной карте
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </motion.div>

                {/* Reset button at bottom */}
                <div className="mt-10 text-center">
                  <button
                    onClick={resetAssessment}
                    className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-medium transition-all hover:bg-[#2E5BFF]/5"
                    style={{ color: '#2E5BFF' }}
                  >
                    <RotateCcw size={16} />
                    Пройти оценку заново
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}
