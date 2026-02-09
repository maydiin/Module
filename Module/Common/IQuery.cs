using MediatR;

namespace Module.Common;

public interface IQuery<out TResponse> : IRequest<TResponse>
{
}
