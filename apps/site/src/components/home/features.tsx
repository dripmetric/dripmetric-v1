import { SectionHead } from '@/components/ui/section-head';
import { FEATURES } from '@/content/site';

/**
 * What happens once a leak is found. Each line is a built, tested feature; src/content/
 * site.ts names the code behind each one. Nothing here contacts the founder's users.
 */
export function Features() {
  return (
    <section className="section section--alt" id="what-you-get" aria-labelledby="features-title">
      <div className="wrap">
        <SectionHead
          label="When something leaks"
          id="features-title"
          title="You hear about it, with the numbers."
          lede="Finding a leak is half the job. Dripmetric also tells you in time to act, and shows you whether what you changed made a difference."
        />
        <dl className="features">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.id}>
              <dt>{feature.title}</dt>
              <dd>{feature.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
